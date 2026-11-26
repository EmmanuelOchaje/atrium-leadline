"use client";

import { useMemo, useState } from "react";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "wagmi/chains";
import { poolSwapTestAbi, addresses, calm, volatile, pump, dump, wash, type SwapStep } from "@leadline/sdk";
import { demoPrivateKey } from "./demo";

export type FlowMode = "calm" | "volatile" | "pump" | "dump" | "wash";

const BASE_AMOUNT = 50n * 10n ** 18n; // ~50 TIDE-scale units; small relative to outside LP depth.

function generate(mode: FlowMode, seed: number): SwapStep[] {
  switch (mode) {
    case "calm":
      return calm(10, seed, BASE_AMOUNT);
    case "volatile":
      return volatile(14, seed, BASE_AMOUNT);
    case "pump":
      return pump(10, seed, BASE_AMOUNT, 8);
    case "dump":
      return dump(10, seed, BASE_AMOUNT, 8);
    case "wash":
      return wash(100, seed, BASE_AMOUNT);
  }
}

/** Runs a seeded swap flow (§9 `flows.ts`) through the local PoolSwapTest router, from the demo swapper account. */
export function useDemoFlow(chainId: 31337) {
  const book = addresses[chainId];
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(
    () =>
      createWalletClient({
        account: privateKeyToAccount(demoPrivateKey("swapper")),
        chain: foundry,
        transport: http("http://127.0.0.1:8545"),
      }),
    []
  );

  async function run(mode: FlowMode, seed = Date.now() % 100000) {
    if (!book) return;
    setIsRunning(true);
    setError(null);
    const key = {
      currency0: book.token0 as `0x${string}`,
      currency1: book.token1 as `0x${string}`,
      fee: book.poolFee,
      tickSpacing: book.tickSpacing,
      hooks: book.hook as `0x${string}`,
    };
    try {
      for (const step of generate(mode, seed)) {
        await client.writeContract({
          address: book.swapRouter as `0x${string}`,
          abi: poolSwapTestAbi,
          functionName: "swap",
          args: [
            key,
            { zeroForOne: step.zeroForOne, amountSpecified: step.amountSpecified, sqrtPriceLimitX96: step.zeroForOne ? 4295128740n : 1461446703485210103287273052203988822378723720528n - 1n },
            { takeClaims: false, settleUsingBurn: false },
            "0x",
          ],
        });
      }
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsRunning(false);
    }
  }

  return { run, isRunning, error };
}
