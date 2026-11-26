/**
 * Default market-maker strategy, shared by the CLI bot and the web autopilot.
 * Deliberately simple: Leadline's innovation is the hook, not the bot.
 */
import { alignDown, alignUp } from "./ticks";

export type CharterState = {
  tick: number;
  tickLower: number;
  tickUpper: number;
  tickSpacing: number;
  minWidth: number;
  maxWidth: number;
  targetDepth: bigint;
  below: bigint;
  above: bigint;
  lastHeartbeat: number; // unix seconds
  graceSeconds: number;
  now: number; // unix seconds
};

export type StrategyAction =
  | { action: "steer"; tickLower: number; tickUpper: number }
  | { action: "ping" }
  | { action: "wait" };

/**
 * Re-centre when the price has left the middle 50% of the range, or when
 * either side's depth has fallen below 110% of target. Otherwise ping once
 * heartbeat age passes 60% of the grace period, so a healthy charter never
 * goes stale.
 */
export function decide(state: CharterState): StrategyAction {
  const { tick, tickLower, tickUpper, tickSpacing, minWidth, maxWidth, targetDepth, below, above, lastHeartbeat, graceSeconds, now } = state;

  const width = tickUpper - tickLower;
  const quarter = width / 4;
  const inMiddleHalf = tick >= tickLower + quarter && tick <= tickUpper - quarter;
  const threshold = (targetDepth * 110n) / 100n;
  const depthLow = below < threshold || above < threshold;

  if (!inMiddleHalf || depthLow) {
    const clampedWidth = Math.min(maxWidth, Math.max(minWidth, width));
    const half = clampedWidth / 2;
    const newLower = alignDown(tick - half, tickSpacing);
    const newUpper = alignUp(tick + half, tickSpacing);
    return { action: "steer", tickLower: newLower, tickUpper: newUpper };
  }

  const heartbeatAge = now - lastHeartbeat;
  if (heartbeatAge > graceSeconds * 0.6) {
    return { action: "ping" };
  }

  return { action: "wait" };
}
