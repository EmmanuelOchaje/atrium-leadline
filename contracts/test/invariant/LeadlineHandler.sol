// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {PoolDonateTest} from "@uniswap/v4-core/src/test/PoolDonateTest.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {LeadlineHook} from "../../src/LeadlineHook.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {MockERC20} from "../utils/MockERC20.sol";

/// @notice Drives one charter through random swaps, time, steering and liveness/payout
/// actions (plus attacker attempts), bounding every call in try/catch so a revert in one
/// action never halts the campaign — the standard invariant-handler shape. Ghost state here
/// backs I1 (claims are the only way a non-issuer balance grows) and I10 (recall never fails)
/// in `Invariants.t.sol`; I6/I8 are checked there straight from the hook's own getters.
contract LeadlineHandler is Test {
    LeadlineHook public hook;
    PoolKey public poolKey;
    PoolSwapTest public swapRouter;
    PoolDonateTest public donateRouter;
    MockERC20 public token0;
    MockERC20 public token1;
    uint256 public charterId;

    address public issuer;
    address public marketMaker;
    address public understudy;
    address public swapper;
    address public attacker;

    uint256 public totalRetainerDeposited;

    // Ghost accounting for I1: every token a non-issuer account ever received, attributed
    // only to `claim()` calls this handler made on that account's behalf.
    mapping(address => mapping(address => uint256)) public ghostClaimed;
    // Balances at construction, so the invariant can assert an exact bound instead of one
    // padded for whatever the fixture minted these accounts before the campaign started.
    mapping(address => mapping(address => uint256)) public startingBalance;
    // Ghost flag for I10: true if `recall()` ever reverted while the charter was still Active
    // or Fallback (i.e. recall should have succeeded but didn't).
    bool public recallFailedUnexpectedly;

    constructor(
        LeadlineHook _hook,
        PoolKey memory _poolKey,
        PoolSwapTest _swapRouter,
        PoolDonateTest _donateRouter,
        MockERC20 _token0,
        MockERC20 _token1,
        uint256 _charterId,
        address _issuer,
        address _marketMaker,
        address _understudy,
        address _swapper,
        address _attacker,
        uint256 _totalRetainerDeposited
    ) {
        hook = _hook;
        poolKey = _poolKey;
        swapRouter = _swapRouter;
        donateRouter = _donateRouter;
        token0 = _token0;
        token1 = _token1;
        charterId = _charterId;
        issuer = _issuer;
        marketMaker = _marketMaker;
        understudy = _understudy;
        swapper = _swapper;
        attacker = _attacker;
        totalRetainerDeposited = _totalRetainerDeposited;

        startingBalance[marketMaker][address(token0)] = _balanceOf(address(token0), marketMaker);
        startingBalance[marketMaker][address(token1)] = _balanceOf(address(token1), marketMaker);
        startingBalance[understudy][address(token0)] = _balanceOf(address(token0), understudy);
        startingBalance[understudy][address(token1)] = _balanceOf(address(token1), understudy);
    }

    function swap(bool zeroForOne, uint256 rawAmount) external {
        int256 amountSpecified = -int256(bound(rawAmount, 1e14, 5e18));
        vm.prank(swapper);
        try swapRouter.swap(
            poolKey,
            SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: amountSpecified,
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        ) {}
            catch {}
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 1, 300));
    }

    function steer(int256 rawLower, int256 rawWidth) external {
        ILeadline.Charter memory c = hook.getCharter(charterId);
        if (c.status == ILeadline.Status.Recalled) return;
        (, int24 tickNow,,) = StateLibrary.getSlot0(hook.poolManager(), poolKey.toId());
        int24 width = int24(int256(bound(uint256(rawWidth), uint256(uint24(c.minWidth)), uint256(uint24(c.maxWidth)))));
        int24 lower = int24(bound(rawLower, int256(tickNow) - int256(width), int256(tickNow)));
        lower = (lower / poolKey.tickSpacing) * poolKey.tickSpacing;
        int24 upper = lower + width;
        vm.prank(marketMaker);
        try hook.steer(charterId, lower, upper) {} catch {}
    }

    function ping() external {
        vm.prank(marketMaker);
        try hook.ping(charterId) {} catch {}
    }

    function poke() external {
        vm.prank(attacker);
        try hook.poke(charterId) {} catch {}
    }

    function handover() external {
        vm.prank(issuer);
        try hook.handover(charterId) {} catch {}
    }

    function settle(uint256 rawMaxEpochs) external {
        uint256 maxEpochs = bound(rawMaxEpochs, 1, 32);
        vm.prank(attacker);
        try hook.settle(charterId, maxEpochs) {} catch {}
    }

    function claim(bool asMarketMaker) external {
        address who = asMarketMaker ? marketMaker : issuer;
        ILeadline.Charter memory c = hook.getCharter(charterId);
        address token = c.retainerToken;
        uint256 before = _balanceOf(token, who);
        vm.prank(who);
        try hook.claim(token) {
            uint256 received = _balanceOf(token, who) - before;
            if (who != issuer) ghostClaimed[who][token] += received;
        } catch {}
    }

    function recall() external {
        ILeadline.Charter memory c = hook.getCharter(charterId);
        bool shouldSucceed = c.status != ILeadline.Status.Recalled;
        vm.prank(issuer);
        try hook.recall(charterId) {}
        catch {
            if (shouldSucceed) recallFailedUnexpectedly = true;
        }
    }

    // ============ Attacker actions ============

    function attackerRecall() external {
        vm.prank(attacker);
        try hook.recall(charterId) {} catch {}
    }

    function attackerSteer(int24 tickLower, int24 tickUpper) external {
        vm.prank(attacker);
        try hook.steer(charterId, tickLower, tickUpper) {} catch {}
    }

    function attackerUnlockCallback() external {
        vm.prank(attacker);
        try hook.unlockCallback("") {} catch {}
    }

    function attackerDonate(uint256 rawAmount0, uint256 rawAmount1) external {
        uint256 amount0 = bound(rawAmount0, 0, 1e18);
        uint256 amount1 = bound(rawAmount1, 0, 1e18);
        vm.prank(attacker);
        try donateRouter.donate(poolKey, amount0, amount1, "") {} catch {}
    }

    function _balanceOf(address token, address who) internal view returns (uint256) {
        (bool ok, bytes memory data) = token.staticcall(abi.encodeWithSignature("balanceOf(address)", who));
        require(ok, "balanceOf failed");
        return abi.decode(data, (uint256));
    }
}
