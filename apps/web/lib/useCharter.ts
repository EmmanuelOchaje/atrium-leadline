import { useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { leadlineHookAbi, addresses } from "@leadline/sdk";

/** Mirrors `ILeadline.Charter` (src/interfaces/ILeadline.sol) field-for-field. */
export type Charter = {
  key: { currency0: `0x${string}`; currency1: `0x${string}`; fee: number; tickSpacing: number; hooks: `0x${string}` };
  issuer: `0x${string}`;
  marketMaker: `0x${string}`;
  understudy: `0x${string}`;
  status: number;
  quoteIsCurrency1: boolean;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  idle0: bigint;
  idle1: bigint;
  fees0: bigint;
  fees1: bigint;
  bandTicks: number;
  minWidth: number;
  maxWidth: number;
  fallbackHalfWidth: number;
  targetDepth: bigint;
  uptimeBps: number;
  epochLength: number;
  graceSeconds: number;
  retainerToken: `0x${string}`;
  retainerPerEpoch: bigint;
  retainerRemaining: bigint;
  termEnd: bigint;
  lastHeartbeat: bigint;
  epochIndex: number;
  epochStart: bigint;
  lastAccrual: bigint;
  belowDepthSeconds: bigint;
  aboveDepthSeconds: bigint;
  secondsInBand: bigint;
  cachedBelow: bigint;
  cachedAbove: bigint;
};

type UseCharterResult = {
  charter: Charter | undefined;
  depth: [bigint, bigint] | undefined;
  score: [number, bigint] | undefined;
  tick: number | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
};

/**
 * Reads a charter's full on-chain state (`getCharter`) plus its live depth,
 * projected score/payout and current pool tick, refetched on every new block.
 */
export function useCharter(chainId: 31337, charterId: bigint): UseCharterResult {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const contract = { address: hook, abi: leadlineHookAbi } as const;

  const { data, refetch, isLoading, error } = useReadContracts({
    contracts: hook
      ? [
          { ...contract, functionName: "getCharter", args: [charterId] },
          { ...contract, functionName: "currentDepth", args: [charterId] },
          { ...contract, functionName: "projectedScore", args: [charterId] },
          { ...contract, functionName: "currentTick", args: [charterId] },
        ]
      : [],
    query: { enabled: Boolean(hook), refetchInterval: 3000 },
  });

  const [charter, depth, score, tick] = data ?? [];

  return {
    charter: charter?.result as Charter | undefined,
    depth: depth?.result as [bigint, bigint] | undefined,
    score: score?.result as [number, bigint] | undefined,
    tick: tick?.result as number | undefined,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

/**
 * Every per-charter write: the market maker's liveness actions (steer, ping)
 * and the issuer's custody actions (handover, setUnderstudy, recall).
 */
export function useCharterActions(chainId: 31337, charterId: bigint) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const { writeContract, isPending, error } = useWriteContract();

  function ping() {
    if (!hook) return;
    writeContract({ address: hook, abi: leadlineHookAbi, functionName: "ping", args: [charterId] });
  }

  function steer(tickLower: number, tickUpper: number) {
    if (!hook) return;
    writeContract({
      address: hook,
      abi: leadlineHookAbi,
      functionName: "steer",
      args: [charterId, tickLower, tickUpper],
    });
  }

  function handover() {
    if (!hook) return;
    writeContract({ address: hook, abi: leadlineHookAbi, functionName: "handover", args: [charterId] });
  }

  function setUnderstudy(addr: `0x${string}`) {
    if (!hook) return;
    writeContract({ address: hook, abi: leadlineHookAbi, functionName: "setUnderstudy", args: [charterId, addr] });
  }

  function recall() {
    if (!hook) return;
    writeContract({ address: hook, abi: leadlineHookAbi, functionName: "recall", args: [charterId] });
  }

  return { ping, steer, handover, setUnderstudy, recall, isPending, error };
}

export function useEpoch(chainId: 31337, charterId: bigint, epoch: number) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;

  return useReadContract({
    address: hook,
    abi: leadlineHookAbi,
    functionName: "getEpoch",
    args: [charterId, epoch],
    query: { enabled: Boolean(hook) },
  });
}
