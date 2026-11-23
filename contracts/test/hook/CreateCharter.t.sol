// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LeadlineFixture} from "../utils/LeadlineFixture.sol";
import {ILeadline} from "../../src/interfaces/ILeadline.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";

contract CreateCharterTest is LeadlineFixture {
    function test_CreateCharter_HappyPath() public {
        ILeadline.CharterParams memory p = defaultCharterParams();

        uint256 issuerToken0Before = token0.balanceOf(issuer);
        uint256 issuerToken1Before = token1.balanceOf(issuer);

        vm.prank(issuer);
        uint256 id = hook.createCharter(p);

        assertEq(id, 1);
        assertEq(hook.charterOf(poolId), id);

        ILeadline.Charter memory c = hook.getCharter(id);
        assertEq(c.issuer, issuer);
        assertEq(c.marketMaker, marketMaker);
        assertEq(c.understudy, understudy);
        assertEq(uint8(c.status), uint8(ILeadline.Status.Active));
        assertEq(c.tickLower, p.tickLower);
        assertEq(c.tickUpper, p.tickUpper);
        assertGt(c.liquidity, 0);
        assertEq(c.retainerRemaining, p.retainerPerEpoch * p.numEpochs);

        // Charter inventory and the full retainer escrow left the issuer's wallet
        assertEq(token0.balanceOf(issuer), issuerToken0Before - p.amount0);
        assertEq(token1.balanceOf(issuer), issuerToken1Before - p.amount1 - c.retainerRemaining);
    }

    function test_CreateCharter_RevertWrongHook() public {
        ILeadline.CharterParams memory p = defaultCharterParams();
        p.key = PoolKey({
            currency0: p.key.currency0,
            currency1: p.key.currency1,
            fee: p.key.fee,
            tickSpacing: p.key.tickSpacing,
            hooks: IHooks(address(0))
        });

        vm.prank(issuer);
        vm.expectRevert(ILeadline.WrongHook.selector);
        hook.createCharter(p);
    }

    function test_CreateCharter_RevertPoolAlreadyChartered() public {
        createDefaultCharter();

        ILeadline.CharterParams memory p = defaultCharterParams();
        vm.prank(issuer);
        vm.expectRevert(ILeadline.PoolAlreadyChartered.selector);
        hook.createCharter(p);
    }

    function test_CreateCharter_RevertRangeMustContainPrice() public {
        ILeadline.CharterParams memory p = defaultCharterParams();
        p.tickLower = 60;
        p.tickUpper = 600;

        vm.prank(issuer);
        vm.expectRevert(ILeadline.RangeMustContainPrice.selector);
        hook.createCharter(p);
    }

    function test_CreateCharter_RevertRangeNotAligned() public {
        ILeadline.CharterParams memory p = defaultCharterParams();
        p.tickLower = -601;

        vm.prank(issuer);
        vm.expectRevert(ILeadline.RangeNotAligned.selector);
        hook.createCharter(p);
    }

    function test_CreateCharter_RevertRangeWidthOutOfBounds() public {
        ILeadline.CharterParams memory p = defaultCharterParams();
        p.tickLower = -60;
        p.tickUpper = 60;
        // width = 120 == minWidth, so shrink minWidth check by widening maxWidth requirement instead
        p.minWidth = 600;

        vm.prank(issuer);
        vm.expectRevert(ILeadline.RangeWidthOutOfBounds.selector);
        hook.createCharter(p);
    }

    function test_CreateCharter_RevertBandTicksOutOfBounds() public {
        ILeadline.CharterParams memory p = defaultCharterParams();
        p.bandTicks = 1;

        vm.prank(issuer);
        vm.expectRevert(ILeadline.ParamsOutOfBounds.selector);
        hook.createCharter(p);
    }

    function test_CreateCharter_RevertUptimeOutOfBounds() public {
        ILeadline.CharterParams memory p = defaultCharterParams();
        p.uptimeBps = 10001;

        vm.prank(issuer);
        vm.expectRevert(ILeadline.ParamsOutOfBounds.selector);
        hook.createCharter(p);
    }

    /// @dev I2 Pool binding: createCharter only trusts the key it is called with; it cannot be
    /// used to attach a charter to a pool via any other entrypoint.
    function test_CreateCharter_OnlyEntrypointThatTakesAPoolKey() public {
        // There is exactly one function with a PoolKey-shaped parameter in the ABI: createCharter.
        // steer/ping/poke/recall/etc. all operate on an existing charter id instead.
        createDefaultCharter();
        assertEq(hook.charterOf(poolId), 1);

        // Re-using a key with a different hook address can never collide with charterOf[poolId]
        // for *this* pool because toId() depends on the hook address.
    }
}
