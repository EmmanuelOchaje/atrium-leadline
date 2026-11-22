#!/usr/bin/env tsx
/**
 * Market maker bot
 * Usage: tsx mm.ts --charter 1 --interval 3 --die-after 90
 */

import { parseArgs } from "util";

const { values } = parseArgs({
  options: {
    charter: { type: "string" },
    interval: { type: "string", default: "3" },
    "die-after": { type: "string" },
  },
});

async function main() {
  const charterId = values.charter || "1";
  const interval = parseInt(values.interval);
  const dieAfter = values["die-after"] ? parseInt(values["die-after"]) : null;

  console.log(`Market maker bot for charter ${charterId}`);
  console.log(`Interval: ${interval}s`);
  if (dieAfter) {
    console.log(`Will stop after ${dieAfter}s`);
  }

  // TODO: Implement market maker logic
  // - Read charter state
  // - Run strategy.decide()
  // - Send steer/ping transactions
  // - Handle graceful shutdown on Ctrl-C
}

main().catch(console.error);
