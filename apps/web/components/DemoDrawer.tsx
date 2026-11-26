"use client";

import { useEffect } from "react";
import { useDemoStore } from "../lib/demo";
import { useDemoFlow, type FlowMode } from "../lib/useDemoFlow";
import { fastForward } from "../lib/anvil";

const FLOWS: { mode: FlowMode; label: string; body: string }[] = [
  { mode: "calm", label: "Calm", body: "Small, roughly balanced swaps." },
  { mode: "volatile", label: "Volatile", body: "Bigger swaps with occasional spikes." },
  { mode: "pump", label: "Pump 8%", body: "Steady buying pressure." },
  { mode: "dump", label: "Dump 8%", body: "Steady selling pressure." },
  { mode: "wash", label: "Wash 100", body: "100 round-trip swaps — tries to pad the score." },
];

/**
 * Demo drawer (key `D`, §11.7): swap flows, the market-maker autopilot
 * ("Kill the bot" switch), and fast-forward to an epoch boundary.
 */
export function DemoDrawer({ epochLength }: { epochLength?: number }) {
  const { demoMode, drawerOpen, setDrawerOpen, autopilot, toggleAutopilot } = useDemoStore();
  const { run, isRunning } = useDemoFlow(31337);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "d" && !e.metaKey && !e.ctrlKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") return;
        setDrawerOpen(!drawerOpen);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!demoMode || !drawerOpen) return null;

  return (
    <div
      role="dialog"
      aria-label="Demo drawer"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        height: "100vh",
        width: 320,
        zIndex: 50,
        padding: 22,
        background: "#0A0A1F",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "-24px 0 48px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#FFFFFF" }}>Demo drawer</h2>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          style={{ background: "transparent", border: 0, color: "#9AAAB8", fontSize: 18, cursor: "pointer" }}
        >
          ×
        </button>
      </div>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: "#9AAAB8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Swap flow</span>
        {FLOWS.map((f) => (
          <button
            key={f.mode}
            type="button"
            disabled={isRunning}
            onClick={() => run(f.mode)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 2,
              padding: "10px 14px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#FFFFFF",
              opacity: isRunning ? 0.5 : 1,
              cursor: isRunning ? "wait" : "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 600 }}>{f.label}</span>
            <span style={{ fontSize: 12, color: "#9AAAB8" }}>{f.body}</span>
          </button>
        ))}
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: "#9AAAB8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Market maker
        </span>
        <button
          type="button"
          onClick={toggleAutopilot}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            borderRadius: 14,
            background: autopilot ? "rgba(198,243,107,0.12)" : "rgba(255,255,255,0.05)",
            border: autopilot ? "1px solid rgba(198,243,107,0.4)" : "1px solid rgba(255,255,255,0.1)",
            color: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Autopilot</span>
            <span style={{ fontSize: 12, color: "#9AAAB8" }}>
              {autopilot ? "Steering every few seconds. Toggle off to kill the bot." : "Off — the market maker is dark."}
            </span>
          </span>
          <span style={{ color: autopilot ? "#C6F36B" : "#9AAAB8", fontWeight: 600 }}>{autopilot ? "On" : "Off"}</span>
        </button>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: "#9AAAB8", textTransform: "uppercase", letterSpacing: "0.04em" }}>Time</span>
        <button
          type="button"
          onClick={() => fastForward(epochLength ?? 120)}
          style={{
            padding: "10px 14px",
            borderRadius: 14,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#FFFFFF",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          Fast-forward to epoch end
        </button>
      </section>

      <p style={{ marginTop: "auto", fontSize: 11.5, color: "#6E7E8D" }}>
        Local chain only. Press <strong>D</strong> to toggle this drawer, <strong>?</strong> for the full keyboard map.
      </p>
    </div>
  );
}
