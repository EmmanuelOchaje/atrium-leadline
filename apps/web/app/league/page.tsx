"use client";

import { Nav } from "../../components/Nav";
import { Starfield } from "../../components/Starfield";
import { Coin } from "../../components/Coin";
import { useLeague } from "../../lib/useLeague";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function LeaguePage() {
  const { rows, loading } = useLeague(31337);

  return (
    <div style={{ background: "#06061A", minHeight: "100vh", padding: 16 }}>
      <Nav />

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 28,
          minHeight: 220,
          background:
            "radial-gradient(620px 300px at 50% 120%, rgba(198,243,107,0.42) 0%, rgba(111,226,177,0.32) 35%, rgba(12,16,52,0) 75%), linear-gradient(180deg, #0B0926 0%, #12204A 60%, #0F3A46 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "40px 24px",
        }}
      >
        <Starfield seed={41} count={40} heightPct={100} />
        <h1 style={{ position: "relative", margin: 0, fontWeight: 700, fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 1, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
          Proving Ground
        </h1>
        <p style={{ position: "relative", margin: "12px 0 0", maxWidth: 560, fontSize: 15.5, lineHeight: "24px", color: "#C9D8E2" }}>
          Market makers ranked by the depth they actually delivered, across every charter they&rsquo;ve held. Built
          from closed epochs onchain, so nobody can fake it.
        </p>
      </section>

      <ol
        aria-label="Ranking"
        style={{
          listStyle: "none",
          margin: "16px 0 0",
          padding: 8,
          borderRadius: 24,
          background: "linear-gradient(180deg, #0F1030, #0A0A20)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {rows.map((row, i) => {
          const maxScore = Math.max(...row.recentScoresBps, 1);
          return (
            <li key={row.marketMaker}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  padding: 14,
                  borderRadius: 18,
                  background: i === 0 ? "linear-gradient(90deg, rgba(198,243,107,0.12), transparent)" : "transparent",
                }}
              >
                <span
                  style={{
                    width: 28,
                    textAlign: "center",
                    fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    fontWeight: 600,
                    fontSize: 15,
                    color: i === 0 ? "#C6F36B" : "#9AAAB8",
                  }}
                >
                  {i + 1}
                </span>
                <Coin address={row.marketMaker} size={36} />
                <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, flexGrow: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 15.5, fontWeight: 600, color: "#FFFFFF" }}>{shortAddr(row.marketMaker)}</span>
                  <span style={{ fontSize: 13, color: "#9AAAB8" }}>
                    {row.epochs} epochs · {row.charterIds.size} charter{row.charterIds.size === 1 ? "" : "s"} ·{" "}
                    {row.handoversAway} handed over
                  </span>
                </span>
                <span aria-hidden="true" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26 }}>
                  {row.recentScoresBps.map((s, j) => (
                    <span
                      key={j}
                      style={{
                        width: 4,
                        height: Math.max((s / maxScore) * 26, 2),
                        borderRadius: 2,
                        background: s >= 7500 ? "#C6F36B" : s >= 4000 ? "#FFC878" : "#FF9B9B",
                      }}
                    />
                  ))}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#FFFFFF",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C6F36B" }} />
                  {(row.avgScoreBps / 100).toFixed(0)}% delivered
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      {!loading && rows.length === 0 && (
        <p style={{ color: "#9AAAB8", fontSize: 14, marginTop: 24, textAlign: "center" }}>
          No closed epochs yet. Run a charter for one epoch to appear here.
        </p>
      )}
    </div>
  );
}
