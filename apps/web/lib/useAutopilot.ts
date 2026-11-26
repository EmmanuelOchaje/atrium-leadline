"use client";

import { useEffect, useRef } from "react";
import { decide, addresses, type CharterState } from "@leadline/sdk";
import type { Charter } from "./useCharter";
import { useDemoActions } from "./useDemoActions";

/**
 * Runs `strategy.decide` in the browser with the market maker's demo key
 * every 3s — the same code the CLI `mm.ts` bot runs, so the live demo needs
 * no separate process (§11.7).
 */
export function useAutopilot(charterId: bigint, charter: Charter | undefined, tick: number | undefined, enabled: boolean) {
  const { steer, ping } = useDemoActions(31337, charterId, "marketMaker");
  const busyRef = useRef(false);

  useEffect(() => {
    if (!enabled || !charter || tick === undefined) return;

    const interval = setInterval(async () => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const state: CharterState = {
          tick,
          tickLower: charter.tickLower,
          tickUpper: charter.tickUpper,
          tickSpacing: addresses[31337]?.tickSpacing ?? 60,
          minWidth: charter.minWidth,
          maxWidth: charter.maxWidth,
          targetDepth: charter.targetDepth,
          below: charter.cachedBelow,
          above: charter.cachedAbove,
          lastHeartbeat: Number(charter.lastHeartbeat),
          graceSeconds: charter.graceSeconds,
          now: Math.floor(Date.now() / 1000),
        };
        const next = decide(state);
        if (next.action === "steer") await steer(next.tickLower, next.tickUpper);
        else if (next.action === "ping") await ping();
      } finally {
        busyRef.current = false;
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [enabled, charter, tick, steer, ping]);
}
