"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { leadlineHookAbi, addresses, depthInBand, scoreEpoch } from "@leadline/sdk";
import type { Charter } from "./useCharter";

type Checkpoint = {
  ts: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tick: number;
  sqrtPriceX96: bigint;
};

export type ReplayEpoch = {
  epoch: number;
  start: number;
  end: number;
  actualScoreBps: number;
  rescoredBps: number;
};

/**
 * Rebuilds the charter's full price/position history from its own events, then
 * re-scores every closed epoch with an alternate band — the backtesting bullet
 * of the theme (§11.10). Recomputes exactly what `_accrue` does on-chain, just
 * client-side and after the fact, segment by segment between state changes.
 */
export function useReplay(chainId: 31337, charterId: bigint, charter: Charter | undefined, altBandTicks: number) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const deployBlock = BigInt(addresses[chainId]?.deployBlock ?? 0);
  const client = usePublicClient({ chainId });
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [epochs, setEpochs] = useState<{ epoch: number; start: number; end: number; scoreBps: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client || !hook) return;
    let cancelled = false;

    client
      .getContractEvents({ address: hook, abi: leadlineHookAbi, fromBlock: deployBlock, toBlock: "latest" })
      .then(async (logs) => {
        const forCharter = logs.filter((log) => (log.args as { id?: bigint }).id === charterId);
        const positionLogs = forCharter.filter((l) =>
          ["CharterCreated", "Steered", "Poked"].includes(l.eventName as string)
        );
        const depthLogs = forCharter.filter((l) => l.eventName === "DepthUpdated");
        const epochLogs = forCharter.filter((l) => l.eventName === "EpochClosed");

        const blockNumbers = Array.from(new Set(forCharter.map((l) => l.blockNumber))).filter((b): b is bigint => b !== null);
        const blocks = await Promise.all(blockNumbers.map((b) => client.getBlock({ blockNumber: b })));
        const tsByBlock = new Map(blocks.map((b) => [b.number, Number(b.timestamp)]));

        const order = (l: (typeof forCharter)[number]) => [l.blockNumber ?? 0n, BigInt(l.logIndex ?? 0)] as const;
        const sortKey = (l: (typeof forCharter)[number]) => order(l)[0] * 1_000_000n + order(l)[1];

        let runningLower = 0;
        let runningUpper = 0;
        let runningLiquidity = 0n;
        const merged = [...positionLogs, ...depthLogs].sort((a, b) => Number(sortKey(a) - sortKey(b)));
        const built: Checkpoint[] = [];
        for (const log of merged) {
          const args = log.args as {
            tickLower?: number;
            tickUpper?: number;
            liquidity?: bigint;
            tick?: number;
            sqrtPriceX96?: bigint;
          };
          if (args.tickLower !== undefined) {
            runningLower = args.tickLower;
            runningUpper = args.tickUpper!;
            runningLiquidity = args.liquidity!;
          }
          if (args.tick !== undefined) {
            const ts = tsByBlock.get(log.blockNumber!) ?? 0;
            built.push({
              ts,
              tickLower: runningLower,
              tickUpper: runningUpper,
              liquidity: runningLiquidity,
              tick: args.tick,
              sqrtPriceX96: args.sqrtPriceX96!,
            });
          }
        }

        const builtEpochs = epochLogs
          .map((l) => {
            const args = l.args as { epoch: number; start: bigint; end: bigint; scoreBps: number };
            return { epoch: args.epoch, start: Number(args.start), end: Number(args.end), scoreBps: args.scoreBps };
          })
          .sort((a, b) => a.epoch - b.epoch);

        if (!cancelled) {
          setCheckpoints(built);
          setEpochs(builtEpochs);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, hook, deployBlock, charterId]);

  const rescored: ReplayEpoch[] = charter
    ? epochs.map((e) => {
        const inWindow = checkpoints.filter((c) => c.ts >= e.start && c.ts < e.end);
        let belowDepthSeconds = 0n;
        let aboveDepthSeconds = 0n;
        let secondsInBand = 0;

        for (let i = 0; i < inWindow.length; i++) {
          const cp = inWindow[i];
          const segEnd = i + 1 < inWindow.length ? inWindow[i + 1].ts : e.end;
          const dt = BigInt(Math.max(0, segEnd - cp.ts));
          if (dt === 0n) continue;

          const [below, above] = depthInBand(
            cp.sqrtPriceX96,
            cp.tick,
            cp.tickLower,
            cp.tickUpper,
            cp.liquidity,
            altBandTicks,
            charter.quoteIsCurrency1
          );
          belowDepthSeconds += below * dt;
          aboveDepthSeconds += above * dt;
          if (below >= charter.targetDepth && above >= charter.targetDepth) {
            secondsInBand += Number(dt);
          }
        }

        const duration = BigInt(Math.max(1, e.end - e.start));
        const rescoredBps = scoreEpoch(
          belowDepthSeconds,
          aboveDepthSeconds,
          BigInt(secondsInBand),
          charter.targetDepth,
          charter.uptimeBps,
          duration
        );

        return { epoch: e.epoch, start: e.start, end: e.end, actualScoreBps: e.scoreBps, rescoredBps };
      })
    : [];

  return { rescored, loading };
}
