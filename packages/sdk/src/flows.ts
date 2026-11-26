/**
 * Seeded swap-flow generators, shared by the CLI flow bot and the web demo
 * drawer. Each produces a fixed list of swaps (direction + size) from a
 * mulberry32 PRNG, so the same seed always plays back the same flow.
 */

export type SwapStep = { zeroForOne: boolean; amountSpecified: bigint };

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small, roughly balanced swaps: a quiet market. */
export function calm(count: number, seed: number, baseAmount: bigint): SwapStep[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    zeroForOne: rand() < 0.5,
    amountSpecified: -((baseAmount * BigInt(Math.floor(rand() * 50 + 50))) / 100n),
  }));
}

/** Larger, less balanced swaps with occasional spikes: a choppy market. */
export function volatile(count: number, seed: number, baseAmount: bigint): SwapStep[] {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => {
    const spike = rand() < 0.15 ? 4 : 1;
    return {
      zeroForOne: rand() < 0.5,
      amountSpecified: -((baseAmount * BigInt(Math.floor((rand() * 150 + 50) * spike))) / 100n),
    };
  });
}

/** Steady one-directional pressure pushing the price up by roughly `pct`%. */
export function pump(count: number, seed: number, baseAmount: bigint, pct: number): SwapStep[] {
  const rand = mulberry32(seed);
  const scale = BigInt(Math.max(1, Math.round(pct * 10)));
  return Array.from({ length: count }, () => ({
    zeroForOne: false, // buying token0 with token1 pushes price up
    amountSpecified: -((baseAmount * scale * BigInt(Math.floor(rand() * 40 + 80))) / 1000n),
  }));
}

/** Steady one-directional pressure pushing the price down by roughly `pct`%. */
export function dump(count: number, seed: number, baseAmount: bigint, pct: number): SwapStep[] {
  const rand = mulberry32(seed);
  const scale = BigInt(Math.max(1, Math.round(pct * 10)));
  return Array.from({ length: count }, () => ({
    zeroForOne: true,
    amountSpecified: -((baseAmount * scale * BigInt(Math.floor(rand() * 40 + 80))) / 1000n),
  }));
}

/**
 * `n` round trips (buy then sell the same size): nets to ~zero price impact,
 * so it's the shape an attacker would use to try to pad fee/score figures.
 */
export function wash(n: number, seed: number, baseAmount: bigint): SwapStep[] {
  const rand = mulberry32(seed);
  const steps: SwapStep[] = [];
  for (let i = 0; i < n; i++) {
    const amount = (baseAmount * BigInt(Math.floor(rand() * 30 + 85))) / 100n;
    steps.push({ zeroForOne: true, amountSpecified: -amount });
    steps.push({ zeroForOne: false, amountSpecified: -amount });
  }
  return steps;
}
