// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeadlineFixture} from "../utils/LeadlineFixture.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";

contract SteerPingPokeTest is LeadlineFixture {
    uint256 internal id;

    function setUp() public override {
        super.setUp();
        id = createDefaultCharter();
    }

    // ============ steer ============

    function test_Steer_HappyPath() public {
        vm.prank(marketMaker);
        hook.steer(id, -1200, 1200);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(c.tickLower, -1200);
        assertEq(c.tickUpper, 1200);
        assertGt(c.liquidity, 0);
        assertEq(uint8(c.status), uint8(ILeadline.Status.Active));
    }

    function test_Steer_RevertNotMarketMaker() public {
        vm.prank(attacker);
        vm.expectRevert(ILeadline.NotMarketMaker.selector);
        hook.steer(id, -1200, 1200);
    }

    /// @dev I4 Bounded steering: every range must contain the current tick, be aligned to
    /// tickSpacing, and have a width within the charter's [minWidth, maxWidth].
    function test_Steer_RevertRangeMustContainPrice() public {
        vm.prank(marketMaker);
        vm.expectRevert(ILeadline.RangeMustContainPrice.selector);
        hook.steer(id, 60, 1200);
    }

    function test_Steer_RevertRangeNotAligned() public {
        vm.prank(marketMaker);
        vm.expectRevert(ILeadline.RangeNotAligned.selector);
        hook.steer(id, -1201, 1200);
    }

    function test_Steer_RevertWidthBelowMin() public {
        // minWidth is 120 for the default charter; a width of 60 must revert.
        vm.prank(marketMaker);
        vm.expectRevert(ILeadline.RangeWidthOutOfBounds.selector);
        hook.steer(id, -60, 0);
    }

    function test_Steer_RevertWidthAboveMax() public {
        // maxWidth is 4000 for the default charter.
        vm.prank(marketMaker);
        vm.expectRevert(ILeadline.RangeWidthOutOfBounds.selector);
        hook.steer(id, -3000, 3000);
    }

    function testFuzz_Steer_AlwaysBoundedAndContainsPrice(int24 tickLower, int24 tickUpper) public {
        ILeadline.Charter memory c0 = hook.getCharter(id);
        tickLower = int24(bound(tickLower, -3000, 3000));
        tickUpper = int24(bound(tickUpper, -3000, 3000));
        vm.assume(tickLower < tickUpper);
        // Align to tick spacing
        tickLower -= tickLower % 60;
        tickUpper -= tickUpper % 60;
        vm.assume(tickLower < tickUpper);

        bool containsPrice = tickLower <= 0 && tickUpper >= 0;
        int24 width = tickUpper - tickLower;
        bool widthOk = width >= c0.minWidth && width <= c0.maxWidth;

        vm.prank(marketMaker);
        if (!containsPrice) {
            vm.expectRevert(ILeadline.RangeMustContainPrice.selector);
            hook.steer(id, tickLower, tickUpper);
        } else if (!widthOk) {
            vm.expectRevert(ILeadline.RangeWidthOutOfBounds.selector);
            hook.steer(id, tickLower, tickUpper);
        } else {
            hook.steer(id, tickLower, tickUpper);
            ILeadline.Charter memory c = hook.getCharter(id);
            assertTrue(c.tickLower <= 0 && c.tickUpper >= 0);
            assertTrue(c.tickUpper - c.tickLower >= c.minWidth && c.tickUpper - c.tickLower <= c.maxWidth);
        }
    }

    // ============ ping ============

    function test_Ping_UpdatesHeartbeat() public {
        vm.warp(block.timestamp + 1 hours);
        vm.prank(marketMaker);
        hook.ping(id);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(c.lastHeartbeat, block.timestamp);
    }

    function test_Ping_RevertNotMarketMaker() public {
        vm.prank(attacker);
        vm.expectRevert(ILeadline.NotMarketMaker.selector);
        hook.ping(id);
    }

    // ============ poke (I9 liveness) ============

    function test_Poke_RevertWhenHeartbeatFresh() public {
        vm.expectRevert(ILeadline.HeartbeatNotStale.selector);
        hook.poke(id);
    }

    function test_Poke_AnyoneCanMoveStaleCharterToFallback() public {
        ILeadline.Charter memory before = hook.getCharter(id);
        vm.warp(block.timestamp + before.graceSeconds + 1);

        // Anyone, including an address with no relation to the charter, can poke.
        vm.prank(attacker);
        hook.poke(id);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(uint8(c.status), uint8(ILeadline.Status.Fallback));
        // Fallback only widens relative to the current tick (band = tick ± fallbackHalfWidth).
        assertLe(c.tickLower, 0);
        assertGe(c.tickUpper, 0);
    }

    function test_Steer_AfterFallbackReturnsToActive() public {
        ILeadline.Charter memory before = hook.getCharter(id);
        vm.warp(block.timestamp + before.graceSeconds + 1);
        hook.poke(id);

        vm.prank(marketMaker);
        hook.steer(id, -1200, 1200);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(uint8(c.status), uint8(ILeadline.Status.Active));
    }
}
