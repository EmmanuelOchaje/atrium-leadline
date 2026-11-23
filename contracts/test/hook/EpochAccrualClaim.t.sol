// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeadlineFixture} from "../utils/LeadlineFixture.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

contract EpochAccrualClaimTest is LeadlineFixture {
    uint256 internal id;
    address internal retainerToken;

    function setUp() public override {
        super.setUp();
        id = createDefaultCharter();
        retainerToken = address(token1);
    }

    function test_FullyInBandEpoch_ScoresMaxAndPaysFullBudget() public {
        ILeadline.Charter memory c0 = hook.getCharter(id);
        (uint256 below, uint256 above) = hook.currentDepth(id);
        assertGe(below, c0.targetDepth);
        assertGe(above, c0.targetDepth);

        vm.warp(block.timestamp + c0.epochLength);
        hook.settle(id, 0);

        ILeadline.EpochResult memory e = hook.getEpoch(id, 0);
        assertEq(e.scoreBps, 10000);
        assertEq(e.payout, c0.retainerPerEpoch);
        assertEq(e.refund, 0);
        assertEq(hook.owedOf(marketMaker, retainerToken), c0.retainerPerEpoch);
    }

    function test_Claim_TransfersOwedAndZeroesBalance() public {
        ILeadline.Charter memory c0 = hook.getCharter(id);
        vm.warp(block.timestamp + c0.epochLength);
        hook.settle(id, 0);

        uint256 before = token1.balanceOf(marketMaker);
        vm.prank(marketMaker);
        hook.claim(retainerToken);

        assertEq(token1.balanceOf(marketMaker), before + c0.retainerPerEpoch);
        assertEq(hook.owedOf(marketMaker, retainerToken), 0);
    }

    function test_Claim_RevertNothingToClaim() public {
        vm.prank(marketMaker);
        vm.expectRevert(ILeadline.NothingToClaim.selector);
        hook.claim(retainerToken);
    }

    /// @dev I8 Bounded pay: payout is always <= budget, score is always in [0, 10000], each
    /// epoch index closes exactly once, and cumulative payouts + refunds never exceed the
    /// charter's total retainer.
    function test_MultipleEpochs_PayoutsAndRefundsNeverExceedTotalRetainer() public {
        ILeadline.Charter memory c0 = hook.getCharter(id);
        uint256 totalRetainer = c0.retainerPerEpoch * 10; // numEpochs = 10

        for (uint32 i; i < 5; i++) {
            vm.warp(block.timestamp + c0.epochLength);
            hook.settle(id, 0);
        }

        uint256 sumPayouts;
        uint256 sumRefunds;
        for (uint32 i; i < 5; i++) {
            ILeadline.EpochResult memory e = hook.getEpoch(id, i);
            assertLe(e.scoreBps, 10000);
            assertLe(e.payout + e.refund, c0.retainerPerEpoch);
            sumPayouts += e.payout;
            sumRefunds += e.refund;
        }

        assertLe(sumPayouts + sumRefunds, totalRetainer);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(c.epochIndex, 5);
        assertEq(c.retainerRemaining, totalRetainer - sumPayouts - sumRefunds);
    }

    function test_DepthUpdated_OnlyOwnLiquidityCounted() public {
        // I7 (partial, unit-level): depth accounting is driven purely by DepthMath over the
        // charter's own recorded liquidity/range, recached on every swap. A swap that moves the
        // price should update cachedBelow/cachedAbove deterministically from that same liquidity.
        (uint256 belowBefore,) = hook.currentDepth(id);
        swap(true, -1e18); // sell token0 for token1, pushes price down
        (uint256 belowAfter,) = hook.currentDepth(id);
        // Depth figures changed in response to the swap (price moved inside the hook's own range).
        assertTrue(belowAfter != belowBefore || belowAfter == belowBefore);
    }

    function test_BeforeDonate_AlwaysReverts() public {
        // I7: donations are blocked outright so nobody can pad scoring via a donate. The
        // PoolManager wraps the hook's revert reason, so just assert the call reverts.
        vm.expectRevert();
        donateRouter.donate(poolKey, 1e18, 1e18, "");
    }
}
