#!/usr/bin/env tsx
/**
 * Swap flow generator bot
 * Usage: tsx flow.ts --mode volatile --seed 7 --rate 2
 */

import { parseArgs } from "util";
import { createWalletClient, http } from "viem";
import { foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { poolSwapTestAbi, addresses, demoPrivateKey, calm, volatile, pump, dump, wash, type SwapStep } from "@leadline/sdk";

const { values } = parseArgs({
  options: {
    mode: { type: "string", default: "calm" },
    seed: { type: "string", default: "0" },
    rate: { type: "string", default: "1" },
    "rpc-url": { type: "string", default: "http://127.0.0.1:8545" },
  },
});

const BASE_AMOUNT = 1n * 10n ** 17n;
const MIN_SQRT = 4295128740n;
const MAX_SQRT = 1461446703485210103287273052203988822378723720528n - 1n;

function generate(mode: string, seed: number): SwapStep[] {
  switch (mode) {
    case "calm":
      return calm(20, seed, BASE_AMOUNT);
    case "volatile":
      return volatile(20, seed, BASE_AMOUNT);
    case "pump":
      return pump(20, seed, BASE_AMOUNT, 8);
    case "dump":
      return dump(20, seed, BASE_AMOUNT, 8);
    case "wash":
      return wash(50, seed, BASE_AMOUNT);
    default:
      throw new Error(`Unknown mode: ${mode}. Use calm|volatile|pump|dump|wash.`);
  }
}

async function main() {
  const mode = values.mode as string;
  const seed = parseInt(values.seed as string, 10);
  const rate = parseInt(values.rate as string, 10);
  const rpcUrl = values["rpc-url"] as string;

  const book = addresses[31337];
  if (!book) throw new Error("No local address book — run DeployLocal.s.sol first");

  const account = privateKeyToAccount(demoPrivateKey("swapper"));
  const client = createWalletClient({ account, chain: foundry, transport: http(rpcUrl) });

  console.log(`Swap flow generator: ${mode} mode (${account.address})`);
  console.log(`Seed: ${seed}, rate: ${rate} swaps/tick`);

  const key = {
    currency0: book.token0 as `0x${string}`,
    currency1: book.token1 as `0x${string}`,
    fee: book.poolFee,
    tickSpacing: book.tickSpacing,
    hooks: book.hook as `0x${string}`,
  };

  const steps = generate(mode, seed);
  let stopped = false;
  process.on("SIGINT", () => {
    console.log("\nStopping.");
    stopped = true;
    process.exit(0);
  });

  for (let i = 0; i < steps.length && !stopped; i += rate) {
    const batch = steps.slice(i, i + rate);
    for (const step of batch) {
      try {
        const hash = await client.writeContract({
          address: book.swapRouter as `0x${string}`,
          abi: poolSwapTestAbi,
          functionName: "swap",
          args: [
            key,
            {
              zeroForOne: step.zeroForOne,
              amountSpecified: step.amountSpecified,
              sqrtPriceLimitX96: step.zeroForOne ? MIN_SQRT : MAX_SQRT,
            },
            { takeClaims: false, settleUsingBurn: false },
            "0x",
          ],
        });
        console.log(`swap ${step.zeroForOne ? "0->1" : "1->0"} ${step.amountSpecified} (${hash})`);
      } catch (e) {
        console.error("swap failed:", (e as Error).message);
      }
    }
  }

  console.log("Flow finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
