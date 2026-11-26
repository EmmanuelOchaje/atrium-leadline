"use client";

import { useState } from "react";
import { DEMO_ROLES } from "../lib/demo";
import { useDemoStore } from "../lib/demo";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * Lets the demo switch which anvil account is "you" without a wallet
 * pop-up (§11.7) — Issuer, Market maker, Understudy, Swapper or Anyone.
 */
export function RoleSwitcher() {
  const { role, setRole } = useDemoStore();
  const [open, setOpen] = useState(false);
  const current = DEMO_ROLES.find((r) => r.role === role) ?? DEMO_ROLES[0];

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          height: 42,
          padding: "0 16px",
          borderRadius: 999,
          background: "rgba(198,243,107,0.1)",
          border: "1px solid rgba(198,243,107,0.35)",
          color: "#DDF7A8",
          fontSize: 14,
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C6F36B", boxShadow: "0 0 10px #C6F36B" }} />
        Role: {current.label} <span style={{ color: "#9AAAB8" }}>{shortAddr(current.address)}</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 20,
            minWidth: 220,
            padding: 6,
            borderRadius: 16,
            background: "#11112C",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.4)",
          }}
        >
          {DEMO_ROLES.map((r) => (
            <button
              key={r.role}
              type="button"
              onClick={() => {
                setRole(r.role);
                setOpen(false);
              }}
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                background: r.role === role ? "rgba(198,243,107,0.12)" : "transparent",
                border: 0,
                color: "#FFFFFF",
                fontSize: 13.5,
                cursor: "pointer",
              }}
            >
              <span>{r.label}</span>
              <span style={{ color: "#9AAAB8" }}>{shortAddr(r.address)}</span>
            </button>
          ))}
          <p style={{ margin: "6px 10px 4px", fontSize: 11.5, color: "#6E7E8D" }}>Demo accounts on a local chain.</p>
        </div>
      )}
    </div>
  );
}
