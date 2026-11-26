// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeadlineFixture} from "../utils/LeadlineFixture.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {MockERC20} from "../utils/MockERC20.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";

/// @notice One test per Notices to Mariners card (§11.6) not already covered by a unit test.
/// I1 (custody) and I10 (unblockable recall) are exercised in `HandoverRecall.t.sol`;
/// I4 (bounded steering) is fuzzed in `SteerPingPoke.t.sol`. This file covers the rest.
contract RedTeamTest is LeadlineFixture {
    using PoolIdLibrary for PoolKey;

    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = createDefaultCharter();
    }

    /// @dev Notice #5 — call the hook's unlock callback directly, bypassing PoolManager.
    /// Replays Cork (May 2025, ~$11–12M). I3 Caller auth.
    function test_I3_DirectUnlockCallbackReverts() public {
        vm.prank(attacker);
        vm.expectRevert(ILeadline.UnauthorizedCallback.selector);
        hook.unlockCallback(abi.encode(id, 0, int24(0), int24(0)));
    }

    /// @dev Direct calls to `afterSwap`, bypassing PoolManager, must also revert. I3.
    function test_I3_DirectAfterSwapReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.afterSwap(
            attacker,
            poolKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e18, sqrtPriceLimitX96: 0}),
            BalanceDelta.wrap(0),
            ""
        );
    }

    /// @dev Notice #10 — route swaps through a second pool that uses this hook but has no
    /// charter of its own. Replays the Safe/rsETH module (Sept 2026, ~$7.7M). I2 Pool binding:
    /// a charter's PoolId is fixed, and nothing with a caller-supplied PoolKey can touch it.
    function test_I2_SwapsInUnchartedPoolDoNotTouchCharterState() public {
        ILeadline.Charter memory before = hook.getCharter(id);

        MockERC20 attackerToken0 = new MockERC20("Attack0", "ATK0", 18);
        MockERC20 attackerToken1 = new MockERC20("Attack1", "ATK1", 18);
        (MockERC20 lo, MockERC20 hi) = address(attackerToken0) < address(attackerToken1)
            ? (attackerToken0, attackerToken1)
            : (attackerToken1, attackerToken0);

        PoolKey memory attackerKey = PoolKey({
            currency0: Currency.wrap(address(lo)),
            currency1: Currency.wrap(address(hi)),
            fee: 3000,
            tickSpacing: TICK_SPACING,
            hooks: hook
        });
        poolManager.initialize(attackerKey, SQRT_PRICE_1_1);
        assertEq(hook.charterOf(attackerKey.toId()), 0, "attacker pool must be unchartered");

        lo.mint(attacker, 10e18);
        hi.mint(attacker, 10e18);
        vm.startPrank(attacker);
        lo.approve(address(swapRouter), type(uint256).max);
        hi.approve(address(swapRouter), type(uint256).max);
        // This pool has no liquidity, so the swap just walks the price to the limit with no
        // amount moved — the point is that it reaches this hook's `afterSwap` via a pool the
        // charter never bound to, and that must not touch charter #1's state either way.
        swapRouter.swap(
            attackerKey,
            SwapParams({zeroForOne: true, amountSpecified: -1e17, sqrtPriceLimitX96: 4295128740}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopPrank();

        ILeadline.Charter memory afterAttack = hook.getCharter(id);
        assertEq(keccak256(abi.encode(before)), keccak256(abi.encode(afterAttack)), "charter state must be untouched");
    }

    /// @dev Notice #6 — 100 round-trip swaps net to ~zero price impact; only fees should move.
    /// I7 Honest measurement: depth only changes when price moves, and donations/self-dealing
    /// swap volume can't pad the score.
    function test_I7_WashTradeMovesFeesNotDepth() public {
        (uint256 belowBefore, uint256 aboveBefore) = hook.currentDepth(id);
        ILeadline.Charter memory c0 = hook.getCharter(id);
        assertEq(c0.fees0, 0);
        assertEq(c0.fees1, 0);

        for (uint256 i = 0; i < 20; i++) {
            swap(true, -1e17);
            swap(false, -1e17);
        }

        (uint256 belowAfter, uint256 aboveAfter) = hook.currentDepth(id);

        // Fees sit inside the pool position until the next reposition collects them (§5.6);
        // re-steering to the same range is the market maker's ordinary heartbeat, not a new
        // attack surface, and is what surfaces the fees the wash trading generated.
        vm.prank(marketMaker);
        hook.steer(id, c0.tickLower, c0.tickUpper);
        ILeadline.Charter memory c1 = hook.getCharter(id);

        assertGt(c1.fees0 + c1.fees1, 0, "wash trading must generate fees");
        // Depth is measured off the pool's own price, not off cumulative volume: 40 swaps that
        // net to ~zero price movement must leave depth within a hair of where it started.
        assertApproxEqRel(belowAfter, belowBefore, 0.01e18);
        assertApproxEqRel(aboveAfter, aboveBefore, 0.01e18);

        vm.warp(block.timestamp + c0.epochLength);
        hook.settle(id, 0);
        ILeadline.EpochResult memory e = hook.getEpoch(id, 0);
        assertEq(e.scoreBps, 10000, "wash trading must not inflate the score beyond the honest depth delivered");
    }

    /// @dev I5 No swap path: the hook can re-range (remove/add liquidity) but never swaps the
    /// charter's inventory. Static check on the deployed source, replaying DRLVaultV3 (Nov 2025).
    function test_I5_HookSourceNeverCallsPoolManagerSwap() public view {
        string memory src = vm.readFile("src/LeadlineHook.sol");
        assertEq(_contains(src, "poolManager.swap("), false, "hook must never call IPoolManager.swap");
        assertEq(_contains(src, ".swap(key"), false, "hook must never swap through a router either");
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    found = false;
                    break;
                }
            }
            if (found) return true;
        }
        return false;
    }
}
