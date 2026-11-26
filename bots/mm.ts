#!/usr/bin/env tsx
/**
 * Market maker bot
 * Usage: tsx mm.ts --charter 1 --interval 3 --die-after 90
 */

import { parseArgs } from "util";
import { createPublicClient, createWalletClient, http } from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { leadlineHookAbi, addresses, decide, demoPrivateKey, type CharterState } from "@leadline/sdk";

const { values } = parseArgs({
  options: {
    charter: { type: "string" },
    interval: { type: "string", default: "3" },
    "die-after": { type: "string" },
    "rpc-url": { type: "string", default: "http://127.0.0.1:8545" },
  },
});

async function main() {
  const charterId = BigInt(values.charter || "1");
  const interval = parseInt(values.interval as string, 10);
  const dieAfter = values["die-after"] ? parseInt(values["die-after"] as string, 10) : null;
  const rpcUrl = values["rpc-url"] as string;

  const book = addresses[31337];
  if (!book) throw new Error("No local address book — run DeployLocal.s.sol first");
  const hook = book.hook as `0x${string}`;

  const account = privateKeyToAccount(demoPrivateKey("marketMaker"));
  const publicClient = createPublicClient({ chain: foundry, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });

  console.log(`Market maker bot for charter ${charterId} (${account.address})`);
  console.log(`Interval: ${interval}s`);
  if (dieAfter) console.log(`Will stop after ${dieAfter}s (simulating going dark)`);

  const startedAt = Date.now();
  let stopped = false;
  process.on("SIGINT", () => {
    console.log("\nStopping.");
    stopped = true;
    process.exit(0);
  });

  while (!stopped) {
    if (dieAfter && Date.now() - startedAt > dieAfter * 1000) {
      console.log("Going dark (die-after reached). No more actions will be sent.");
      await sleep(interval * 1000);
      continue;
    }

    try {
      const charter = (await publicClient.readContract({
        address: hook,
        abi: leadlineHookAbi,
        functionName: "getCharter",
        args: [charterId],
      })) as {
        tickLower: number;
        tickUpper: number;
        minWidth: number;
        maxWidth: number;
        targetDepth: bigint;
        cachedBelow: bigint;
        cachedAbove: bigint;
        lastHeartbeat: bigint;
        graceSeconds: number;
      };
      const tick = (await publicClient.readContract({
        address: hook,
        abi: leadlineHookAbi,
        functionName: "currentTick",
        args: [charterId],
      })) as number;

      const state: CharterState = {
        tick,
        tickLower: charter.tickLower,
        tickUpper: charter.tickUpper,
        tickSpacing: book.tickSpacing,
        minWidth: charter.minWidth,
        maxWidth: charter.maxWidth,
        targetDepth: charter.targetDepth,
        below: charter.cachedBelow,
        above: charter.cachedAbove,
        lastHeartbeat: Number(charter.lastHeartbeat),
        graceSeconds: charter.graceSeconds,
        now: Math.floor(Date.now() / 1000),
      };

      const action = decide(state);
      if (action.action === "steer") {
        const hash = await walletClient.writeContract({
          address: hook,
          abi: leadlineHookAbi,
          functionName: "steer",
          args: [charterId, action.tickLower, action.tickUpper],
        });
        console.log(`steer -> [${action.tickLower}, ${action.tickUpper}] (${hash})`);
      } else if (action.action === "ping") {
        const hash = await walletClient.writeContract({ address: hook, abi: leadlineHookAbi, functionName: "ping", args: [charterId] });
        console.log(`ping (${hash})`);
      } else {
        console.log("wait");
      }
    } catch (e) {
      console.error("action failed:", (e as Error).message);
    }

    await sleep(interval * 1000);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
