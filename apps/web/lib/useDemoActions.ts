"use client";

import { useMemo, useState } from "react";
import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "wagmi/chains";
import { leadlineHookAbi, erc20Abi, addresses } from "@leadline/sdk";
import { demoPrivateKey, type DemoRole } from "./demo";

/**
 * Sends every per-charter write directly from a demo account's private key,
 * over a local viem wallet client — no wagmi connector, no wallet pop-up.
 * Demo mode only; real wallets use `useCharterActions` instead.
 */
export function useDemoActions(chainId: 31337, charterId: bigint, role: DemoRole) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(
    () =>
      createWalletClient({
        account: privateKeyToAccount(demoPrivateKey(role)),
        chain: foundry,
        transport: http("http://127.0.0.1:8545"),
      }),
    [role]
  );

  async function send(functionName: string, args: readonly unknown[]): Promise<Hash | undefined> {
    if (!hook) return undefined;
    setIsPending(true);
    setError(null);
    try {
      return await client.writeContract({ address: hook, abi: leadlineHookAbi, functionName, args } as never);
    } catch (e) {
      setError(e as Error);
      return undefined;
    } finally {
      setIsPending(false);
    }
  }

  return {
    ping: () => send("ping", [charterId]),
    steer: (tickLower: number, tickUpper: number) => send("steer", [charterId, tickLower, tickUpper]),
    poke: () => send("poke", [charterId]),
    settle: (maxEpochs = 32n) => send("settle", [charterId, maxEpochs]),
    claim: (token: `0x${string}`) => send("claim", [token]),
    handover: () => send("handover", [charterId]),
    recall: () => send("recall", [charterId]),
    approve: (token: `0x${string}`, spender: `0x${string}`, amount: bigint) =>
      hook
        ? client.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [spender, amount] })
        : undefined,
    client,
    isPending,
    error,
  };
}
