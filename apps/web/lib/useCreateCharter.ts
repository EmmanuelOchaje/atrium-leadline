import { useState } from "react";
import { usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { parseUnits } from "viem";
import { leadlineHookAbi, erc20Abi, addresses } from "@leadline/sdk";

export type CreateCharterInput = {
  tideAmountHuman: string;
  usdcAmountHuman: string;
  tickLower: number;
  tickUpper: number;
  bandTicks: number;
  minWidth: number;
  maxWidth: number;
  fallbackHalfWidth: number;
  targetDepthUsdcHuman: string;
  uptimeBps: number;
  epochLength: number;
  graceSeconds: number;
  numEpochs: number;
  retainerPerEpochUsdcHuman: string;
  marketMaker: `0x${string}`;
  understudy: `0x${string}`;
};

/**
 * Resolves which of token0/token1 is USDC (6dp quote) vs TIDE (18dp) by
 * reading decimals back — deploy-time address sort order isn't predictable —
 * then approves both tokens (inventory + the full retainer escrow) and calls
 * createCharter, in order.
 */
export function useCreateCharter(chainId: 31337) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const token0 = addresses[chainId]?.token0 as `0x${string}` | undefined;
  const token1 = addresses[chainId]?.token1 as `0x${string}` | undefined;
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId });
  const [step, setStep] = useState<"idle" | "approve0" | "approve1" | "create" | "done" | "error">("idle");
  const [charterId, setCharterId] = useState<bigint | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const { data: decimalsData } = useReadContracts({
    contracts:
      token0 && token1
        ? [
            { address: token0, abi: erc20Abi, functionName: "decimals" },
            { address: token1, abi: erc20Abi, functionName: "decimals" },
          ]
        : [],
    query: { enabled: Boolean(token0 && token1) },
  });
  const decimals0 = decimalsData?.[0]?.result as number | undefined;
  const decimals1 = decimalsData?.[1]?.result as number | undefined;

  async function create(input: CreateCharterInput) {
    if (!hook || !token0 || !token1 || !client || decimals0 === undefined || decimals1 === undefined) return;
    setError(null);

    try {
      const usdcIsToken0 = decimals0 === 6;
      const amount0 = parseUnits(usdcIsToken0 ? input.usdcAmountHuman : input.tideAmountHuman, decimals0);
      const amount1 = parseUnits(usdcIsToken0 ? input.tideAmountHuman : input.usdcAmountHuman, decimals1);
      const usdcDecimals = usdcIsToken0 ? decimals0 : decimals1;
      const retainerToken = usdcIsToken0 ? token0 : token1;
      const retainerPerEpoch = parseUnits(input.retainerPerEpochUsdcHuman || "0", usdcDecimals);
      const targetDepth = parseUnits(input.targetDepthUsdcHuman || "0", usdcDecimals);
      const totalRetainer = retainerPerEpoch * BigInt(input.numEpochs);

      setStep("approve0");
      const tx0 = await writeContractAsync({
        address: token0,
        abi: erc20Abi,
        functionName: "approve",
        args: [hook, amount0 + (retainerToken === token0 ? totalRetainer : 0n)],
      });
      await client.waitForTransactionReceipt({ hash: tx0 });

      setStep("approve1");
      const tx1 = await writeContractAsync({
        address: token1,
        abi: erc20Abi,
        functionName: "approve",
        args: [hook, amount1 + (retainerToken === token1 ? totalRetainer : 0n)],
      });
      await client.waitForTransactionReceipt({ hash: tx1 });

      setStep("create");
      const createTx = await writeContractAsync({
        address: hook,
        abi: leadlineHookAbi,
        functionName: "createCharter",
        args: [
          {
            key: {
              currency0: token0,
              currency1: token1,
              fee: addresses[chainId].poolFee,
              tickSpacing: addresses[chainId].tickSpacing,
              hooks: hook,
            },
            marketMaker: input.marketMaker,
            understudy: input.understudy,
            quoteIsCurrency1: !usdcIsToken0,
            amount0,
            amount1,
            tickLower: input.tickLower,
            tickUpper: input.tickUpper,
            bandTicks: input.bandTicks,
            minWidth: input.minWidth,
            maxWidth: input.maxWidth,
            fallbackHalfWidth: input.fallbackHalfWidth,
            targetDepth,
            uptimeBps: input.uptimeBps,
            epochLength: input.epochLength,
            graceSeconds: input.graceSeconds,
            numEpochs: input.numEpochs,
            retainerToken,
            retainerPerEpoch,
          },
        ],
      });
      const receipt = await client.waitForTransactionReceipt({ hash: createTx });

      const createdLog = receipt.logs.find((log) => log.address.toLowerCase() === hook.toLowerCase());
      // CharterCreated's first indexed topic (after the event signature) is the id.
      const id = createdLog?.topics[1] ? BigInt(createdLog.topics[1]) : null;
      setCharterId(id);
      setStep("done");
    } catch (e) {
      setError(e as Error);
      setStep("error");
    }
  }

  return { create, step, charterId, error };
}
