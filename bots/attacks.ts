#!/usr/bin/env tsx
/**
 * Scripted red-team attacks
 * Usage: tsx attacks.ts --attack custody
 */

import { parseArgs } from "util";

const attacks = [
  "custody",
  "steer-far",
  "donate",
  "wash",
  "callback",
  "pool-key",
  "double-settle",
];

const { values } = parseArgs({
  options: {
    attack: { type: "string" },
  },
});

async function main() {
  const attack = values.attack;

  if (!attack || !attacks.includes(attack)) {
    console.error(`Usage: tsx attacks.ts --attack <${attacks.join("|")}>`);
    process.exit(1);
  }

  console.log(`Running attack: ${attack}`);

  // TODO: Implement attacks
  // - Read from RedTeam.t.sol for each test case
  // - Execute via local RPC
  // - Report result (blocked/changed nothing/succeeded)
}

main().catch(console.error);
