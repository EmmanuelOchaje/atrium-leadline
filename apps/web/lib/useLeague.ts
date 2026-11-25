import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { leadlineHookAbi, addresses } from "@leadline/sdk";

export type LeagueRow = {
  marketMaker: `0x${string}`;
  charterIds: Set<bigint>;
  epochs: number;
  avgScoreBps: number;
  avgSecondsInBandPct: number;
  handoversAway: number;
};

/**
 * Aggregates every closed epoch across every charter into a per-market-maker
 * scorecard — the Proving Ground league, built from real `EpochClosed` and
 * `HandedOver` events instead of seeded fixtures.
 */
export function useLeague(chainId: 31337) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const deployBlock = BigInt(addresses[chainId]?.deployBlock ?? 0);
  const client = usePublicClient({ chainId });
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client || !hook) return;
    let cancelled = false;

    Promise.all([
      client.getContractEvents({
        address: hook,
        abi: leadlineHookAbi,
        eventName: "EpochClosed",
        fromBlock: deployBlock,
        toBlock: "latest",
      }),
      client.getContractEvents({
        address: hook,
        abi: leadlineHookAbi,
        eventName: "HandedOver",
        fromBlock: deployBlock,
        toBlock: "latest",
      }),
    ])
      .then(([epochLogs, handoverLogs]) => {
        if (cancelled) return;

        const byMm = new Map<string, LeagueRow>();
        for (const log of epochLogs) {
          const args = log.args as {
            id: bigint;
            marketMaker: `0x${string}`;
            scoreBps: number;
            secondsInBand: bigint;
            start: bigint;
            end: bigint;
          };
          const key = args.marketMaker.toLowerCase();
          const row = byMm.get(key) ?? {
            marketMaker: args.marketMaker,
            charterIds: new Set<bigint>(),
            epochs: 0,
            avgScoreBps: 0,
            avgSecondsInBandPct: 0,
            handoversAway: 0,
          };
          row.charterIds.add(args.id);
          const duration = Number(args.end - args.start) || 1;
          const uptimePct = (Number(args.secondsInBand) / duration) * 100;
          row.avgScoreBps = (row.avgScoreBps * row.epochs + args.scoreBps) / (row.epochs + 1);
          row.avgSecondsInBandPct = (row.avgSecondsInBandPct * row.epochs + uptimePct) / (row.epochs + 1);
          row.epochs += 1;
          byMm.set(key, row);
        }

        for (const log of handoverLogs) {
          const args = log.args as { from: `0x${string}` };
          const key = args.from.toLowerCase();
          const row = byMm.get(key);
          if (row) row.handoversAway += 1;
        }

        setRows(Array.from(byMm.values()).sort((a, b) => b.avgScoreBps - a.avgScoreBps));
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client, hook, deployBlock]);

  return { rows, loading };
}
