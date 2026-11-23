// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ILeadline} from "../interfaces/ILeadline.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title CharterLib
/// @notice Parameter validation and epoch scoring math
library CharterLib {
    // Global caps (§5.8)
    int24 internal constant MIN_BAND_TICKS = 10;
    int24 internal constant MAX_BAND_TICKS = 2000;
    int24 internal constant MIN_WIDTH_FLOOR = 20;
    int24 internal constant MAX_WIDTH_CEIL = 40000;
    uint32 internal constant MIN_EPOCH = 60;
    uint32 internal constant MAX_EPOCH = 30 days;
    uint32 internal constant MIN_GRACE = 30;
    uint32 internal constant MAX_EPOCHS = 1000;
    uint32 internal constant MAX_EPOCHS_PER_ACCRUE = 32;
    uint256 internal constant MAX_TARGET_DEPTH = type(uint128).max;

    /// @notice Validate charter parameters
    function validateParams(ILeadline.CharterParams calldata p, int24 currentTick, int24 tickSpacing) internal pure {
        // bandTicks in range
        if (p.bandTicks < MIN_BAND_TICKS || p.bandTicks > MAX_BAND_TICKS) {
            revert ILeadline.ParamsOutOfBounds();
        }

        // Range contains current tick
        if (p.tickLower > currentTick || p.tickUpper < currentTick) {
            revert ILeadline.RangeMustContainPrice();
        }

        // Range is aligned to tickSpacing
        if (p.tickLower % tickSpacing != 0 || p.tickUpper % tickSpacing != 0) {
            revert ILeadline.RangeNotAligned();
        }

        // Range width within bounds
        int24 width = p.tickUpper - p.tickLower;
        if (width < p.minWidth || width > p.maxWidth) {
            revert ILeadline.RangeWidthOutOfBounds();
        }

        // Width bounds within global caps
        if (p.minWidth < MIN_WIDTH_FLOOR || p.maxWidth > MAX_WIDTH_CEIL) {
            revert ILeadline.ParamsOutOfBounds();
        }

        // Epoch length in range
        if (p.epochLength < MIN_EPOCH || p.epochLength > MAX_EPOCH) {
            revert ILeadline.ParamsOutOfBounds();
        }

        // Grace seconds >= MIN_GRACE
        if (p.graceSeconds < MIN_GRACE) {
            revert ILeadline.ParamsOutOfBounds();
        }

        // Number of epochs in range
        if (p.numEpochs == 0 || p.numEpochs > MAX_EPOCHS) {
            revert ILeadline.ParamsOutOfBounds();
        }

        // Target depth in range
        if (p.targetDepth > MAX_TARGET_DEPTH) {
            revert ILeadline.ParamsOutOfBounds();
        }

        // Uptime target is a valid percentage
        if (p.uptimeBps > 10000) {
            revert ILeadline.ParamsOutOfBounds();
        }
    }

    /// @notice Validate steering parameters
    function validateSteer(
        ILeadline.Charter storage c,
        int24 newTickLower,
        int24 newTickUpper,
        int24 currentTick,
        int24 tickSpacing
    ) internal view {
        // Must contain current tick
        if (newTickLower > currentTick || newTickUpper < currentTick) {
            revert ILeadline.RangeMustContainPrice();
        }

        // Must be aligned
        if (newTickLower % tickSpacing != 0 || newTickUpper % tickSpacing != 0) {
            revert ILeadline.RangeNotAligned();
        }

        // Width must be within bounds
        int24 width = newTickUpper - newTickLower;
        if (width < c.minWidth || width > c.maxWidth) {
            revert ILeadline.RangeWidthOutOfBounds();
        }
    }

    /// @notice Score a closed epoch
    /// Returns the score (0..10000) and payout amount
    function scoreEpoch(ILeadline.Charter storage c, uint64 epochEnd)
        internal
        view
        returns (uint16 scoreBps, uint256 payout, uint256 refund)
    {
        uint64 epochStart = c.epochStart;
        uint256 duration = epochEnd - epochStart;

        // Handle zero duration edge case
        if (duration == 0) {
            return (0, 0, c.retainerPerEpoch);
        }

        // Depth scores: belowBps = min(10000, belowDepthSeconds × 10000 / (target × T))
        uint256 belowScore =
            c.belowDepthSeconds == 0 ? 0 : FullMath.mulDiv(c.belowDepthSeconds * 10000, 1, c.targetDepth * duration);
        if (belowScore > 10000) belowScore = 10000;

        uint256 aboveScore =
            c.aboveDepthSeconds == 0 ? 0 : FullMath.mulDiv(c.aboveDepthSeconds * 10000, 1, c.targetDepth * duration);
        if (aboveScore > 10000) aboveScore = 10000;

        // Depth is the minimum of below and above
        uint256 depthScore = belowScore < aboveScore ? belowScore : aboveScore;

        // Uptime score: uptimeBps_ = min(10000, secondsInBand × 10000 / (uptimeTarget × T / 10000))
        // Simplifies to: secondsInBand × 10000^2 / (uptimeTarget × T × 10000)
        uint256 uptimeTarget = (c.uptimeBps * duration) / 10000;
        uint256 uptimeScore =
            c.secondsInBand == 0 || uptimeTarget == 0 ? 0 : FullMath.mulDiv(c.secondsInBand * 10000, 1, uptimeTarget);
        if (uptimeScore > 10000) uptimeScore = 10000;

        // Combined score = depthScore × uptimeScore / 10000
        scoreBps = uint16(FullMath.mulDiv(depthScore, uptimeScore, 10000));

        // Budget for this epoch: retainerPerEpoch × T / epochLength (capped at retainerRemaining)
        uint256 budget = FullMath.mulDiv(c.retainerPerEpoch, duration, c.epochLength);
        if (budget > c.retainerRemaining) {
            budget = c.retainerRemaining;
        }

        // Payout: budget × scoreBps / 10000
        payout = FullMath.mulDiv(budget, scoreBps, 10000);
        refund = budget - payout;
    }
}
