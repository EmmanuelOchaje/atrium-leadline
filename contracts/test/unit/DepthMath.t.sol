// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {DepthMath} from "../../src/libraries/DepthMath.sol";

contract DepthMathTest is Test {
    function test_EdgeCase_RangeOutsideBand() public pure {
        // Range entirely outside band should return (0, 0)
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(0);
        int24 tick = 0;
        int24 tickLower = 100;
        int24 tickUpper = 200;
        uint128 liquidity = 1e18;
        int24 bandTicks = 10;

        (uint256 below, uint256 above) =
            DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, liquidity, bandTicks, true);

        assertEq(below, 0, "Below depth should be 0 when range is above price");
        assertEq(above, 0, "Above depth should be 0 when range is above price");
    }

    function test_MonotonicInLiquidity() public pure {
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(0);
        int24 tick = 0;
        int24 tickLower = -10;
        int24 tickUpper = 10;
        int24 bandTicks = 5;

        (uint256 below1, uint256 above1) =
            DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, 1e18, bandTicks, true);

        (uint256 below2, uint256 above2) =
            DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, 2e18, bandTicks, true);

        // Doubling liquidity should roughly double depth (allowing for rounding)
        assertGt(below2, below1, "Doubling liquidity should increase below depth");
        assertGt(above2, above1, "Doubling liquidity should increase above depth");
    }

    function test_PriceBelowRange() public pure {
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(-100);
        int24 tick = -100;
        int24 tickLower = 0;
        int24 tickUpper = 100;
        uint128 liquidity = 1e18;
        int24 bandTicks = 10;

        (uint256 below, uint256 above) =
            DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, liquidity, bandTicks, true);

        assertEq(below, 0, "Below depth should be 0 when price is below range");
    }

    function test_PriceAboveRange() public pure {
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(100);
        int24 tick = 100;
        int24 tickLower = 0;
        int24 tickUpper = 50;
        uint128 liquidity = 1e18;
        int24 bandTicks = 10;

        (uint256 below, uint256 above) =
            DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, liquidity, bandTicks, true);

        assertEq(above, 0, "Above depth should be 0 when price is above range");
    }

    function test_NoRevertsWithBoundaryTicks() public pure {
        uint160 sqrtP = TickMath.getSqrtPriceAtTick(0);
        int24 tick = 0;
        int24 tickLower = TickMath.MIN_TICK;
        int24 tickUpper = TickMath.MAX_TICK;
        uint128 liquidity = 1e18;
        int24 bandTicks = 1000;

        // Should not revert even with extreme ticks
        (uint256 below, uint256 above) =
            DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, liquidity, bandTicks, true);

        // Values should be non-zero for a range covering the price
        assertGt(below + above, 0, "Should have some depth with range covering price");
    }
}
