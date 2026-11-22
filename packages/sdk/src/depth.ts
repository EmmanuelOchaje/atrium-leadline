/**
 * TypeScript mirror of DepthMath.sol
 * Calculates in-band liquidity depth for Leadline charters
 */

import { getTickAtSqrtPrice, getSqrtPriceAtTick } from "./ticks";

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const ONE = 1n << 96n; // 2^96 for fixed point math

/**
 * Multiply then divide with rounding down
 */
function mulDiv(a: bigint, b: bigint, c: bigint): bigint {
  if (c === 0n) throw new Error("Division by zero");
  return (a * b) / c;
}

/**
 * Calculate depth (in quote token units) inside the band for a liquidity position
 * @param sqrtPrice Current price as sqrtPrice in 1.96 fixed point
 * @param tick Current tick
 * @param tickLower Lower bound of liquidity position
 * @param tickUpper Upper bound of liquidity position
 * @param liquidity Liquidity amount
 * @param bandTicks Half-width of the band in ticks
 * @param quoteIsCurrency1 Whether currency1 is the quote token
 * @returns [depthBelow, depthAbove] in quote units
 */
export function depthInBand(
  sqrtPrice: bigint,
  tick: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  bandTicks: number,
  quoteIsCurrency1: boolean
): [bigint, bigint] {
  // Band limits
  let bandLo = tick - bandTicks;
  let bandHi = tick + bandTicks;

  if (bandLo < MIN_TICK) bandLo = MIN_TICK;
  if (bandHi > MAX_TICK) bandHi = MAX_TICK;

  let depthBelow = 0n;
  let depthAbove = 0n;

  // Below price (inside band): [max(tickLower, bandLo), min(tickUpper, tick)]
  {
    const sqrtALowerTick = Math.max(tickLower, bandLo);
    const sqrtBUpperTick = Math.min(tickUpper, tick);

    if (sqrtALowerTick < sqrtBUpperTick) {
      const sqrtA = getSqrtPriceAtTick(sqrtALowerTick);
      const sqrtB = getSqrtPriceAtTick(sqrtBUpperTick);

      if (sqrtA < sqrtB) {
        // amount1Below = getAmount1Delta(sqrtA, sqrtB, L, false)
        const amount1Below = mulDiv(
          liquidity,
          sqrtB - sqrtA,
          ONE
        );

        if (quoteIsCurrency1) {
          depthBelow = amount1Below;
        } else {
          // Convert token1 to quote: multiply by sqrtPrice twice / 2^192
          depthBelow = mulDiv(
            mulDiv(amount1Below, sqrtPrice, ONE),
            sqrtPrice,
            ONE
          );
        }
      }
    }
  }

  // Above price (inside band): [max(sqrtP, sqrtAt(tickLower)), min(sqrtAt(tickUpper), sqrtAt(bandHi))]
  {
    const sqrtALowerTick = Math.max(tickLower, tick);
    const sqrtBUpperTick = Math.min(tickUpper, bandHi);

    if (sqrtALowerTick < sqrtBUpperTick) {
      const sqrtA = getSqrtPriceAtTick(sqrtALowerTick);
      const sqrtB = getSqrtPriceAtTick(sqrtBUpperTick);

      // For above, effective lower is max(sqrtPrice, sqrtA)
      const sqrtAEffective = sqrtPrice > sqrtA ? sqrtPrice : sqrtA;

      if (sqrtAEffective < sqrtB) {
        // amount0Above = getAmount0Delta(sqrtAEffective, sqrtB, L, false)
        const amount0Above = mulDiv(
          liquidity,
          sqrtB - sqrtAEffective,
          sqrtAEffective
        );

        if (quoteIsCurrency1) {
          // Convert token0 to quote: divide by sqrtPrice twice
          depthAbove = mulDiv(
            mulDiv(amount0Above, ONE, sqrtPrice),
            ONE,
            sqrtPrice
          );
        } else {
          depthAbove = amount0Above;
        }
      }
    }
  }

  return [depthBelow, depthAbove];
}

/**
 * Score an epoch based on delivered depth and uptime
 * @param belowDepthSeconds Accumulated depth-seconds below price
 * @param aboveDepthSeconds Accumulated depth-seconds above price
 * @param secondsInBand Seconds where both sides met target
 * @param targetDepth Target depth per side
 * @param uptimeBps Target uptime in basis points
 * @param duration Epoch duration in seconds
 * @returns scoreBps (0..10000)
 */
export function scoreEpoch(
  belowDepthSeconds: bigint,
  aboveDepthSeconds: bigint,
  secondsInBand: bigint,
  targetDepth: bigint,
  uptimeBps: number,
  duration: bigint
): number {
  if (duration === 0n) return 0;

  // Depth scores
  const belowScore = belowDepthSeconds === 0n
    ? 0n
    : mulDiv(belowDepthSeconds * 10000n, 1n, targetDepth * duration);
  const belowScoreCapped = belowScore > 10000n ? 10000n : belowScore;

  const aboveScore = aboveDepthSeconds === 0n
    ? 0n
    : mulDiv(aboveDepthSeconds * 10000n, 1n, targetDepth * duration);
  const aboveScoreCapped = aboveScore > 10000n ? 10000n : aboveScore;

  // Depth = min(below, above)
  const depthScore = belowScoreCapped < aboveScoreCapped
    ? belowScoreCapped
    : aboveScoreCapped;

  // Uptime score
  const uptimeTarget = BigInt(uptimeBps) * duration / 10000n;
  const uptimeScore = secondsInBand === 0n || uptimeTarget === 0n
    ? 0n
    : mulDiv(secondsInBand * 10000n, 1n, uptimeTarget);
  const uptimeScoreCapped = uptimeScore > 10000n ? 10000n : uptimeScore;

  // Combined: depth × uptime / 10000
  const finalScore = mulDiv(depthScore, uptimeScoreCapped, 10000n);

  return Number(finalScore);
}
