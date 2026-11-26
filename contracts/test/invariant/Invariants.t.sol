// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeadlineFixture} from "../utils/LeadlineFixture.sol";
import {LeadlineHandler} from "./LeadlineHandler.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {PoolDonateTest} from "@uniswap/v4-core/src/test/PoolDonateTest.sol";

/// @notice Invariant campaign over random swap/warp/steer/liveness/payout/attacker action
/// sequences (§7). Checks I1 (non-issuer balances only grow via claim), I6 (the hook holds
/// at least as much of each token as it owes out) and I8/retainer conservation (payouts +
/// refunds + what's left can never exceed what the issuer deposited) after every call —
/// Foundry's default invariant behavior. I10 (recall never fails) is a handler ghost flag;
/// I4 is fuzzed separately in `SteerPingPoke.t.sol`.
contract InvariantsTest is LeadlineFixture {
    LeadlineHandler internal handler;
    uint256 internal id;
    uint256 internal totalRetainerDeposited;

    function setUp() public override {
        super.setUp();
        id = createDefaultCharter();
        ILeadline.CharterParams memory p = defaultCharterParams();
        totalRetainerDeposited = p.retainerPerEpoch * p.numEpochs;

        PoolDonateTest donateRouter = new PoolDonateTest(poolManager);
        token0.mint(attacker, 10_000e18);
        token1.mint(attacker, 10_000e18);
        vm.startPrank(attacker);
        token0.approve(address(donateRouter), type(uint256).max);
        token1.approve(address(donateRouter), type(uint256).max);
        vm.stopPrank();

        handler = new LeadlineHandler(
            hook,
            poolKey,
            swapRouter,
            donateRouter,
            token0,
            token1,
            id,
            issuer,
            marketMaker,
            understudy,
            swapper,
            attacker,
            totalRetainerDeposited
        );

        targetContract(address(handler));
    }

    /// I1 Custody: a non-issuer account's token balance only ever grows by what this
    /// campaign's `claim()` calls actually paid it.
    function invariant_NonIssuerBalanceOnlyGrowsViaClaim() public view {
        _checkGrewOnlyViaClaim(marketMaker);
        _checkGrewOnlyViaClaim(understudy);
    }

    function _checkGrewOnlyViaClaim(address who) internal view {
        uint256 start0 = handler.startingBalance(who, address(token0));
        uint256 start1 = handler.startingBalance(who, address(token1));
        uint256 claimed0 = handler.ghostClaimed(who, address(token0));
        uint256 claimed1 = handler.ghostClaimed(who, address(token1));
        assertEq(token0.balanceOf(who), start0 + claimed0, "token0 balance grew by more than claims");
        assertEq(token1.balanceOf(who), start1 + claimed1, "token1 balance grew by more than claims");
    }

    /// I6 Conservation: the hook's real balance of each token covers everything it still
    /// owes against that token — idle inventory plus every tracked account's pull-payment
    /// balance. `c.fees0/fees1` is a cumulative display counter, not a separate liability:
    /// `_removeLiquidity` credits every fee straight into `owed[issuer]` the moment it's
    /// collected, so it's already inside `owed0`/`owed1` below.
    function invariant_HookBalanceCoversTrackedLiabilities() public view {
        ILeadline.Charter memory c = hook.getCharter(id);

        uint256 owed0 = hook.owedOf(issuer, address(token0)) + hook.owedOf(marketMaker, address(token0))
            + hook.owedOf(understudy, address(token0));
        uint256 owed1 = hook.owedOf(issuer, address(token1)) + hook.owedOf(marketMaker, address(token1))
            + hook.owedOf(understudy, address(token1));

        assertGe(token0.balanceOf(address(hook)), c.idle0 + owed0, "token0: hook balance short of liabilities");
        assertGe(token1.balanceOf(address(hook)), c.idle1 + owed1, "token1: hook balance short of liabilities");
    }

    /// I8 Bounded pay / retainer conservation: nothing ever pays out more than the issuer
    /// put in. What's been paid, refunded or is still owed can never exceed the deposit.
    function invariant_RetainerNeverExceedsDeposit() public view {
        ILeadline.Charter memory c = hook.getCharter(id);
        uint256 paidOut = 0;
        uint256 refunded = 0;
        for (uint32 e = 0; e < c.epochIndex; e++) {
            ILeadline.EpochResult memory epoch = hook.getEpoch(id, e);
            assertLe(epoch.scoreBps, 10000, "scoreBps over 100%");
            paidOut += epoch.payout;
            refunded += epoch.refund;
        }
        assertLe(paidOut + refunded + c.retainerRemaining, totalRetainerDeposited, "retainer over-allocated");
    }

    /// I10 Unblockable recall: every `recall()` the handler called while the charter was
    /// still Active/Fallback succeeded.
    function invariant_RecallNeverFailsWhileActive() public view {
        assertFalse(handler.recallFailedUnexpectedly(), "recall failed while it should have succeeded");
    }
}
