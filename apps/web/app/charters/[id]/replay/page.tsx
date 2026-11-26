"use client";

import { useState } from "react";
import { Nav } from "../../../../components/Nav";
import { useCharter } from "../../../../lib/useCharter";
import { useReplay } from "../../../../lib/useReplay";
import { pctToTicks } from "@leadline/sdk";

const BAND_OPTIONS = [
  { label: "±1%", pct: 1 },
  { label: "±2%", pct: 2 },
  { label: "±5%", pct: 5 },
];

export default function ReplayPage({ params }: { params: { id: string } }) {
  const charterId = BigInt(params.id);
  const { charter, isLoading } = useCharter(31337, charterId);
  const [pct, setPct] = useState(1);
  const [custom, setCustom] = useState("");

  const effectivePct = custom ? Number(custom) || 0 : pct;
  const bandTicks = pctToTicks(effectivePct);
  const { rescored, loading } = useReplay(31337, charterId, charter, bandTicks);

  const originalBandPct = charter ? (Math.pow(1.0001, charter.bandTicks) - 1) * 100 : 0;

  return (
    <div className="composer-page">
      <Nav />

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Replay</h1>
          <p className="text-muted max-w-2xl">
            Every closed epoch of charter #{params.id}, re-scored with a different depth band from its own
            event history — the same way a different charter would have judged this market maker.
          </p>
          <p className="text-xs text-muted max-w-2xl">
            Approximation: uses the pool&rsquo;s own price and position history (tick, liquidity) at the time, but
            depth is recomputed client-side rather than read back from the chain for every instant — the shape
            `sdk/depth.ts` mirrors exactly, not a separate estimate.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 py-4 border-y border-rule">
          <span className="text-sm text-muted mr-2">
            Charter&rsquo;s own band: {charter ? `±${originalBandPct.toFixed(1)}%` : "…"}. Re-score with:
          </span>
          {BAND_OPTIONS.map((o) => (
            <button
              key={o.pct}
              type="button"
              onClick={() => {
                setPct(o.pct);
                setCustom("");
              }}
              className="h-9 px-4 rounded-full border text-sm font-semibold"
              style={{
                borderColor: "var(--rule)",
                background: !custom && pct === o.pct ? "var(--survey)" : "white",
                color: !custom && pct === o.pct ? "white" : "var(--survey)",
              }}
            >
              {o.label}
            </button>
          ))}
          <input
            type="number"
            min={0.1}
            max={30}
            step={0.1}
            placeholder="custom %"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="h-9 w-28 px-3 rounded-full border text-sm"
            style={{ borderColor: "var(--rule)" }}
          />
        </div>

        {isLoading || loading ? (
          <p className="text-muted">Loading charter history…</p>
        ) : rescored.length === 0 ? (
          <p className="text-muted">No closed epochs yet. Run a charter for one epoch to appear here.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {rescored.map((e) => (
              <div key={e.epoch} className="flex items-center gap-6 py-4 border-b border-rule">
                <span className="w-20 text-sm text-muted">Epoch {e.epoch}</span>
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-xs text-muted">Actual</span>
                    <div className="flex-1 h-3 rounded-full bg-shoal overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${e.actualScoreBps / 100}%`, background: "var(--contour)" }} />
                    </div>
                    <span className="w-12 text-xs text-right tabular-nums">{(e.actualScoreBps / 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-xs text-muted">±{effectivePct}%</span>
                    <div className="flex-1 h-3 rounded-full bg-shoal overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${e.rescoredBps / 100}%`, background: "var(--magenta)" }} />
                    </div>
                    <span className="w-12 text-xs text-right tabular-nums">{(e.rescoredBps / 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            ))}
            <p className="text-sm text-muted mt-2">
              With a ±{effectivePct}% band, this market maker would have delivered an average of{" "}
              {(rescored.reduce((s, e) => s + e.rescoredBps, 0) / rescored.length / 100).toFixed(0)}% instead of{" "}
              {(rescored.reduce((s, e) => s + e.actualScoreBps, 0) / rescored.length / 100).toFixed(0)}%.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
