import { useEffect, useState } from "react";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { leadlineHookAbi, addresses } from "@leadline/sdk";

export type CharterEvent = {
  blockNumber: bigint;
  logIndex: number;
  transactionHash: `0x${string}`;
  eventName: string;
  args: Record<string, unknown>;
};

/**
 * Historical + live log of a charter's lifecycle events, newest first.
 * Pulls from the deploy block once, then appends new blocks as they land.
 */
export function useCharterEvents(chainId: 31337, charterId: bigint, limit = 50) {
  const hook = addresses[chainId]?.hook as `0x${string}` | undefined;
  const deployBlock = BigInt(addresses[chainId]?.deployBlock ?? 0);
  const client = usePublicClient({ chainId });
  const [events, setEvents] = useState<CharterEvent[]>([]);

  useEffect(() => {
    if (!client || !hook) return;
    let cancelled = false;

    client
      .getContractEvents({
        address: hook,
        abi: leadlineHookAbi,
        fromBlock: deployBlock,
        toBlock: "latest",
      })
      .then((logs) => {
        if (cancelled) return;
        const forThisCharter = logs.filter(
          (log) => (log.args as { id?: bigint }).id === charterId
        );
        setEvents(toCharterEvents(forThisCharter).slice(-limit).reverse());
      })
      .catch(() => {
        // Local chain not reachable yet; the live watcher below will pick it up once it is.
      });

    return () => {
      cancelled = true;
    };
  }, [client, hook, deployBlock, charterId, limit]);

  const onLogs = (logs: readonly any[]) => {
    const forThisCharter = logs.filter((log) => (log.args as { id?: bigint }).id === charterId);
    if (forThisCharter.length === 0) return;
    setEvents((prev) => [...toCharterEvents(forThisCharter).reverse(), ...prev].slice(0, limit));
  };

  useWatchContractEvent({ address: hook, abi: leadlineHookAbi, eventName: "Steered", enabled: Boolean(hook), onLogs });
  useWatchContractEvent({ address: hook, abi: leadlineHookAbi, eventName: "Pinged", enabled: Boolean(hook), onLogs });
  useWatchContractEvent({ address: hook, abi: leadlineHookAbi, eventName: "Poked", enabled: Boolean(hook), onLogs });
  useWatchContractEvent({
    address: hook,
    abi: leadlineHookAbi,
    eventName: "HandedOver",
    enabled: Boolean(hook),
    onLogs,
  });
  useWatchContractEvent({
    address: hook,
    abi: leadlineHookAbi,
    eventName: "EpochClosed",
    enabled: Boolean(hook),
    onLogs,
  });
  useWatchContractEvent({ address: hook, abi: leadlineHookAbi, eventName: "Recalled", enabled: Boolean(hook), onLogs });

  return events;
}

function toCharterEvents(logs: readonly any[]): CharterEvent[] {
  return logs.map((log) => ({
    blockNumber: log.blockNumber,
    logIndex: log.logIndex,
    transactionHash: log.transactionHash,
    eventName: log.eventName,
    args: log.args,
  }));
}
