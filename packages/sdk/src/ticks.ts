/**
 * Tick and price utilities for Leadline
 */

const MIN_TICK = -887272;
const MAX_TICK = 887272;
const MIN_SQRT_RATIO = 4295128739n; // sqrt(MIN_PRICE) * 2^96
const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723720528n; // sqrt(MAX_PRICE) * 2^96

/**
 * Calculate sqrtPrice at a given tick
 * Based on Uniswap v4 TickMath
 */
export function getSqrtPriceAtTick(tick: number): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error("Tick out of bounds");
  }

  const absTick = tick < 0 ? -tick : tick;

  let ratio: bigint;
  if ((absTick & 1) !== 0) {
    ratio = 0xfffcb933bd6fad37aa2d162d1a594001n;
  } else {
    ratio = 0x100000000000000000000000000000000n;
  }

  if ((absTick & 2) !== 0) ratio = mulShift(ratio, 0xfff97272373d413259a46990580e213an, 128);
  if ((absTick & 4) !== 0) ratio = mulShift(ratio, 0xfff2e50f5f656932ef12357cf3c7fdccn, 128);
  if ((absTick & 8) !== 0) ratio = mulShift(ratio, 0xffe5caca7e10e81c6005c0a47eab6855n, 128);
  if ((absTick & 16) !== 0) ratio = mulShift(ratio, 0xffcb9843d60cb079ab0487293830cddan, 128);
  if ((absTick & 32) !== 0) ratio = mulShift(ratio, 0xff973b41fa98c081472e6896d71fcac6n, 128);
  if ((absTick & 64) !== 0) ratio = mulShift(ratio, 0xff2ea16466c96a3843ec78b326b52861n, 128);
  if ((absTick & 128) !== 0) ratio = mulShift(ratio, 0xfe5dee046a99a2a811c461f1969c3053n, 128);
  if ((absTick & 256) !== 0) ratio = mulShift(ratio, 0xfcbe86c7900a88aedcffc83b479aa3a4n, 128);
  if ((absTick & 512) !== 0) ratio = mulShift(ratio, 0xf987a7253ac413176c9aa498e32603e7n, 128);
  if ((absTick & 1024) !== 0) ratio = mulShift(ratio, 0xf3392b9b746f78b82c8d4c77ecdac1f0n, 128);
  if ((absTick & 2048) !== 0) ratio = mulShift(ratio, 0xe7159475a2863a7c7efad4aa841223c6n, 128);
  if ((absTick & 4096) !== 0) ratio = mulShift(ratio, 0xd097f3bdfd2022b8845ad8f792aa5825n, 128);
  if ((absTick & 8192) !== 0) ratio = mulShift(ratio, 0xa9f746462d870fdf8865dc1910d7fd2bn, 128);
  if ((absTick & 16384) !== 0) ratio = mulShift(ratio, 0x70d869a156d2a1549910adc5a9f52a1en, 128);
  if ((absTick & 32768) !== 0) ratio = mulShift(ratio, 0x31be676da05a0dfe6d6b2bead3b208b5n, 128);
  if ((absTick & 65536) !== 0) ratio = mulShift(ratio, 0x9aa508b5b7a84e1c6d0b7bee0f86d6a1n, 128);

  if (tick > 0) ratio = (1n << 192n) / ratio;

  // Apply the rounding correction
  return ratio / (1n << 32n);
}

function mulShift(a: bigint, b: bigint, shift: number): bigint {
  return (a * b) >> BigInt(shift);
}

/**
 * Calculate tick at a given sqrtPrice
 * Approximate using binary search
 */
export function getTickAtSqrtPrice(sqrtPrice: bigint): number {
  let lo = MIN_TICK;
  let hi = MAX_TICK;

  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const sqrtAtMid = getSqrtPriceAtTick(mid);

    if (sqrtAtMid < sqrtPrice) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return lo;
}

/**
 * Convert percentage band to ticks
 * Example: ±2% = ln(1.02) / ln(1.0001) ≈ 198 ticks
 */
export function pctToTicks(pct: number): number {
  const ratio = 1 + pct / 100;
  const ticks = Math.log(ratio) / Math.log(1.0001);
  return Math.round(ticks);
}

/**
 * Align a tick down to the nearest multiple of spacing
 */
export function alignDown(tick: number, spacing: number): number {
  if (tick >= 0) {
    return Math.floor(tick / spacing) * spacing;
  } else {
    return -Math.ceil(-tick / spacing) * spacing;
  }
}

/**
 * Align a tick up to the nearest multiple of spacing
 */
export function alignUp(tick: number, spacing: number): number {
  if (tick >= 0) {
    return Math.ceil(tick / spacing) * spacing;
  } else {
    return -Math.floor(-tick / spacing) * spacing;
  }
}

/**
 * Convert tick to price (token1 per token0)
 * accounting for decimals
 */
export function tickToPrice(
  tick: number,
  decimal0: number,
  decimal1: number
): string {
  const sqrtPrice = getSqrtPriceAtTick(tick);
  const decimals = 1n << 96n;

  // Price = (sqrtPrice / 2^96)^2 * 10^(decimals0 - decimals1)
  const priceBig = (sqrtPrice * sqrtPrice) / (decimals * decimals);
  const decimalAdjust = BigInt(10 ** (decimal1 - decimal0));

  const price = priceBig * decimalAdjust;
  return price.toString();
}

/**
 * Format a price for display
 */
export function formatPrice(price: bigint | number, decimals = 4): string {
  if (typeof price === "number") {
    price = BigInt(Math.floor(price));
  }

  const priceNum = Number(price);
  if (priceNum < 0.0001) {
    return priceNum.toExponential(2);
  }

  return priceNum.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
