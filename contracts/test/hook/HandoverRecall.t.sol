// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeadlineFixture} from "../utils/LeadlineFixture.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";

/// @dev A market maker whose receive/fallback always reverts. recall must still succeed because
/// payouts are pull-based (owed), never pushed to the market maker directly.
contract RevertingMarketMaker {
    receive() external payable {
        revert("no");
    }
}

contract HandoverRecallTest is LeadlineFixture {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = createDefaultCharter();
    }

    // ============ setUnderstudy / handover (I9) ============

    function test_SetUnderstudy_OnlyIssuer() public {
        vm.prank(attacker);
        vm.expectRevert(ILeadline.NotIssuer.selector);
        hook.setUnderstudy(id, attacker);
    }

    function test_Handover_OnlyIssuer() public {
        vm.prank(attacker);
        vm.expectRevert(ILeadline.NotIssuer.selector);
        hook.handover(id);
    }

    function test_Handover_RevertNoUnderstudy() public {
        vm.prank(issuer);
        hook.setUnderstudy(id, address(0));

        vm.prank(issuer);
        vm.expectRevert(ILeadline.NoUnderstudy.selector);
        hook.handover(id);
    }

    function test_Handover_ClosesEpochAndSwapsInUnderstudy() public {
        ILeadline.Charter memory c0 = hook.getCharter(id);
        vm.warp(block.timestamp + c0.epochLength / 2);

        vm.prank(issuer);
        hook.handover(id);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(c.marketMaker, understudy);
        assertEq(c.understudy, address(0));
        assertEq(c.epochIndex, 1);

        ILeadline.EpochResult memory e = hook.getEpoch(id, 0);
        assertEq(e.marketMaker, marketMaker);

        // The old market maker can no longer steer; the new one (the understudy) can.
        vm.prank(marketMaker);
        vm.expectRevert(ILeadline.NotMarketMaker.selector);
        hook.steer(id, -1200, 1200);

        vm.prank(understudy);
        hook.steer(id, -1200, 1200);
    }

    // ============ recall (I1 custody, I10 unblockable recall) ============

    function test_Recall_OnlyIssuer() public {
        vm.prank(attacker);
        vm.expectRevert(ILeadline.NotIssuer.selector);
        hook.recall(id);
    }

    function test_Recall_ReturnsIdleInventoryAndRetainerToIssuer() public {
        ILeadline.Charter memory c0 = hook.getCharter(id);
        uint256 issuerToken1Before = token1.balanceOf(issuer);

        vm.prank(issuer);
        hook.recall(id);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(uint8(c.status), uint8(ILeadline.Status.Recalled));
        assertEq(c.idle0, 0);
        assertEq(c.idle1, 0);

        // Nothing was accrued yet, so the whole retainer comes back as a claimable refund.
        assertEq(hook.owedOf(issuer, c0.retainerToken), c0.retainerRemaining);

        vm.prank(issuer);
        hook.claim(c0.retainerToken);
        assertGt(token1.balanceOf(issuer), issuerToken1Before);
    }

    function test_Recall_IsIdempotentlyBlockedAfterFirstCall() public {
        vm.prank(issuer);
        hook.recall(id);

        vm.prank(issuer);
        vm.expectRevert(ILeadline.CharterNotActive.selector);
        hook.recall(id);
    }

    /// @dev I10 Unblockable recall: recall must succeed even when the market maker is a
    /// contract that reverts on receiving funds, because recall never pushes tokens to the MM.
    function test_Recall_SucceedsEvenIfMarketMakerContractReverts() public {
        RevertingMarketMaker evilMM = new RevertingMarketMaker();

        ILeadline.CharterParams memory p = defaultCharterParams();
        p.marketMaker = address(evilMM);
        p.key.fee = 500; // distinct pool from the one `id` already charters
        poolManager.initialize(p.key, SQRT_PRICE_1_1);
        vm.prank(issuer);
        uint256 id2 = hook.createCharter(p);

        // Let an epoch pass so the "evil" MM accrues a payout it never pulls.
        vm.warp(block.timestamp + p.epochLength);

        vm.prank(issuer);
        hook.recall(id2); // must not revert

        ILeadline.Charter memory c = hook.getCharter(id2);
        assertEq(uint8(c.status), uint8(ILeadline.Status.Recalled));
    }

    /// @dev I1 Custody: the only way charter inventory leaves the hook to a non-issuer account
    /// is via that account's own `owed` balance through `claim`.
    function test_Recall_NeverPaysMarketMakerDirectly() public {
        uint256 mmToken0Before = token0.balanceOf(marketMaker);
        uint256 mmToken1Before = token1.balanceOf(marketMaker);

        vm.prank(issuer);
        hook.recall(id);

        assertEq(token0.balanceOf(marketMaker), mmToken0Before);
        assertEq(token1.balanceOf(marketMaker), mmToken1Before);
    }
}
