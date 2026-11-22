// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title DepthMath
/// @notice Calculates in-band liquidity depth for a position relative to current price and band
library DepthMath {
    /// @notice Calculate the depth (in quote token units) inside the band for a liquidity position
    /// @param sqrtPriceX96 Current price as sqrtPrice in 1.96 fixed point
    /// @param tick Current tick
    /// @param tickLower Lower bound of the liquidity position
    /// @param tickUpper Upper bound of the liquidity position
    /// @param liquidity The liquidity amount
    /// @param bandTicks Half-width of the band in ticks (depth band = tick ± bandTicks)
    /// @param quoteIsCurrency1 Whether currency1 is the quote token
    /// @return depthBelow Depth below current price, in quote units
    /// @return depthAbove Depth above current price, in quote units
    function depthInBand(
        uint160 sqrtPriceX96,
        int24 tick,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        int24 bandTicks,
        bool quoteIsCurrency1
    ) internal pure returns (uint256 depthBelow, uint256 depthAbove) {
        // Band limits: tick ± bandTicks, clamped to [TickMath.MIN_TICK, TickMath.MAX_TICK]
        int24 bandLo = tick - bandTicks;
        int24 bandHi = tick + bandTicks;

        if (bandLo < TickMath.MIN_TICK) bandLo = TickMath.MIN_TICK;
        if (bandHi > TickMath.MAX_TICK) bandHi = TickMath.MAX_TICK;

        // Below price (inside band): [max(tickLower, bandLo), min(tickUpper, tick)]
        {
            int24 sqrtALowerTick = tickLower > bandLo ? tickLower : bandLo;
            int24 sqrtBUpperTick = tickUpper < tick ? tickUpper : tick;

            if (sqrtALowerTick < sqrtBUpperTick) {
                uint160 sqrtA = TickMath.getSqrtPriceAtTick(sqrtALowerTick);
                uint160 sqrtB = TickMath.getSqrtPriceAtTick(sqrtBUpperTick);

                if (sqrtA < sqrtB) {
                    uint256 amount1Below =
                        SqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, liquidity, false);

                    if (quoteIsCurrency1) {
                        depthBelow = amount1Below;
                    } else {
                        // Convert token1 to quote (currency0): multiply by sqrtPrice twice / 2^192
                        depthBelow =
                            FullMath.mulDiv(FullMath.mulDiv(amount1Below, sqrtPriceX96, 2 ** 96), sqrtPriceX96, 2 ** 96);
                    }
                }
            }
        }

        // Above price (inside band): [max(sqrtP, sqrtAt(tickLower)), min(sqrtAt(tickUpper), sqrtAt(bandHi))]
        {
            int24 sqrtALowerTick = tickLower > tick ? tickLower : tick;
            int24 sqrtBUpperTick = tickUpper < bandHi ? tickUpper : bandHi;

            if (sqrtALowerTick < sqrtBUpperTick) {
                uint160 sqrtA = TickMath.getSqrtPriceAtTick(sqrtALowerTick);
                uint160 sqrtB = TickMath.getSqrtPriceAtTick(sqrtBUpperTick);

                // For above, we need to use max(sqrtPrice, sqrtA) as the lower bound
                uint160 sqrtAEffective = sqrtPriceX96 > sqrtA ? sqrtPriceX96 : sqrtA;

                if (sqrtAEffective < sqrtB) {
                    uint256 amount0Above =
                        SqrtPriceMath.getAmount0Delta(sqrtAEffective, sqrtB, liquidity, false);

                    if (quoteIsCurrency1) {
                        // Convert token0 to quote (currency1): divide by sqrtPrice twice / 2^192
                        depthAbove = FullMath.mulDiv(FullMath.mulDiv(amount0Above, 2 ** 96, sqrtPriceX96), 2 ** 96, sqrtPriceX96);
                    } else {
                        depthAbove = amount0Above;
                    }
                }
            }
        }
    }
}
