"use client";

import Link from "next/link";
import { Nav } from "../components/Nav";
import { Starfield } from "../components/Starfield";

const STEPS = [
  {
    n: "01",
    title: "Write a charter",
    body: "The issuer sets the depth band, the target per side and the retainer, then deposits inventory into the hook.",
    accent: "#CEFFEA",
  },
  {
    n: "02",
    title: "The market maker steers",
    body: "They move the range as the price moves. It must contain the price, and the tokens never leave the hook.",
    accent: "#CEFFEA",
  },
  {
    n: "03",
    title: "The pool measures depth",
    body: "After every swap, the hook records how much liquidity sat inside the band, and for how long.",
    accent: "#DED6FF",
  },
  {
    n: "04",
    title: "Pay follows delivery",
    body: "Each epoch the market maker earns the share of the retainer it delivered. The rest goes back to the issuer.",
    accent: "#C6F36B",
    glow: true,
  },
];

export default function LandingPage() {
  return (
    <div style={{ background: "#06061A", padding: 16 }}>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 32,
          minHeight: 760,
          background:
            "radial-gradient(900px 520px at 50% 108%, rgba(198,243,107,0.55) 0%, rgba(111,226,177,0.45) 28%, rgba(25,110,118,0.35) 55%, rgba(12,16,52,0) 80%), linear-gradient(180deg, #0B0926 0%, #101A44 45%, #0D3346 78%, #105246 100%)",
        }}
      >
        <Starfield seed={11} count={60} />

        <Nav />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 26,
            padding: "56px 24px 0",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.16)",
              fontSize: 14,
              color: "#D7E6EE",
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C6F36B", boxShadow: "0 0 10px #C6F36B" }} />
            A Uniswap v4 hook, built for UHI11
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(44px, 7vw, 96px)",
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              maxWidth: 1000,
            }}
          >
            <span style={{ display: "block", color: "#FFFFFF" }}>Let the pool</span>
            <span
              style={{
                display: "block",
                background: "linear-gradient(90deg, #FFFFFF 0%, #B7F5D8 55%, #C6F36B 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              prove the depth.
            </span>
          </h1>
          <p style={{ margin: 0, maxWidth: 620, fontSize: 18, lineHeight: "28px", color: "#C9D8E2" }}>
            Leadline holds a token issuer&rsquo;s liquidity inside the pool. Market makers can steer it but never
            take it, and they&rsquo;re paid only for the depth they actually deliver.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
            <Link
              href="/charters/1"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 50,
                padding: "0 24px",
                borderRadius: 999,
                background: "#FFFFFF",
                color: "#0B0926",
                fontSize: 16,
                fontWeight: 600,
                boxShadow: "0 10px 30px rgba(198,243,107,0.25)",
              }}
            >
              Open the live charter
            </Link>
            <Link
              href="/charters/new"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 50,
                padding: "0 24px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.22)",
                color: "#FFFFFF",
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              Write a charter
            </Link>
          </div>
        </div>

        <div style={{ position: "relative", maxWidth: 1000, height: 320, margin: "40px auto 0" }}>
          <svg viewBox="0 0 1000 320" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
            <g fill="none" stroke="#DFFFEF">
              <circle cx="500" cy="340" r="110" style={{ strokeOpacity: 0.5, strokeWidth: 1.5 }} />
              <circle cx="500" cy="340" r="170" style={{ strokeOpacity: 0.36, strokeWidth: 1.2, strokeDasharray: "100 12" }} />
              <circle cx="500" cy="340" r="230" style={{ strokeOpacity: 0.26, strokeWidth: 1 }} />
              <circle cx="500" cy="340" r="290" className="ll-ping" style={{ strokeOpacity: 0.6, strokeWidth: 2 }} />
            </g>
          </svg>
          <div className="ll-lead" aria-hidden="true" style={{ position: "absolute", left: "calc(50% - 1px)", top: 0, bottom: 60, width: 2, background: "#C6F36B" }} />
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "calc(50% - 13px)",
              bottom: 40,
              width: 26,
              height: 22,
              background: "#C6F36B",
              clipPath: "polygon(22% 0, 78% 0, 100% 100%, 0 100%)",
              boxShadow: "0 0 22px #C6F36B",
            }}
          />
          <div style={{ position: "absolute", left: "calc(50% - 220px)", right: "calc(50% - 220px)", bottom: 170, borderTop: "1.5px dashed rgba(255,255,255,0.75)" }} />
          <span style={{ position: "absolute", left: "calc(50% + 230px)", bottom: 162, fontSize: 13, color: "#FFFFFF" }}>Target, 25,000 USDC per side</span>

          <div style={{ position: "absolute", left: 0, top: 50, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, color: "#B9CAD6" }}>Below price</span>
            <span style={{ fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>
              27,400<span style={{ color: "#7C8C99", fontSize: 16 }}> USDC</span>
            </span>
          </div>
          <div style={{ position: "absolute", right: 0, top: 50, display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
            <span style={{ fontSize: 13, color: "#B9CAD6" }}>Above price</span>
            <span style={{ fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>
              21,920<span style={{ color: "#7C8C99", fontSize: 16 }}> USDC</span>
            </span>
          </div>
          <div style={{ position: "absolute", left: 0, bottom: 20, display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, color: "#B9CAD6" }}>Time in band</span>
            <span style={{ fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>
              85.5<span style={{ color: "#7C8C99" }}>%</span>
            </span>
          </div>
          <div style={{ position: "absolute", right: 0, bottom: 20, display: "flex", flexDirection: "column", gap: 2, textAlign: "right" }}>
            <span style={{ fontSize: 13, color: "#B9CAD6" }}>Paid this epoch</span>
            <span style={{ fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 30, fontWeight: 500, letterSpacing: "-0.02em" }}>
              416<span style={{ color: "#7C8C99" }}>.00 / 500</span>
            </span>
          </div>
        </div>
      </section>

      <section
        aria-label="Built with"
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "44px 24px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "20px 64px",
          fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: "#5D6A80",
        }}
      >
        <span>Uniswap v4 hooks</span>
        <span>OpenZeppelin</span>
        <span>Foundry</span>
        <span>viem</span>
        <span>wagmi</span>
      </section>

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          marginTop: 16,
          borderRadius: 32,
          padding: "64px 32px 72px",
          background:
            "radial-gradient(620px 360px at 88% 110%, rgba(198,243,107,0.28), transparent 70%), radial-gradient(520px 320px at 8% -10%, rgba(155,140,255,0.22), transparent 70%), linear-gradient(180deg, #0C1030 0%, #0A1A2E 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 24,
            marginBottom: 48,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontWeight: 700,
              fontSize: "clamp(36px, 5vw, 60px)",
              lineHeight: 0.95,
              letterSpacing: "-0.035em",
              color: "#FFFFFF",
            }}
          >
            How a charter runs
          </h2>
          <p style={{ margin: 0, maxWidth: 420, fontSize: 16, lineHeight: "24px", color: "#B9CAD6" }}>
            Four steps, all onchain. The issuer keeps custody the whole way, and pay only moves when depth is
            delivered.
          </p>
        </div>
        <ol
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {STEPS.map((s) => (
            <li
              key={s.n}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
                padding: 24,
                borderRadius: 24,
                background: s.glow ? "linear-gradient(180deg, rgba(198,243,107,0.16), rgba(198,243,107,0.04))" : "rgba(255,255,255,0.045)",
                border: s.glow ? "1px solid rgba(198,243,107,0.45)" : "1px solid rgba(255,255,255,0.1)",
                boxShadow: s.glow ? "0 0 40px rgba(198,243,107,0.12)" : "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <span style={{ fontWeight: 300, fontSize: 56, lineHeight: 1, letterSpacing: "-0.04em", color: s.accent }}>
                {s.n}
              </span>
              <h3 style={{ margin: 0, fontWeight: 600, fontSize: 22, letterSpacing: "-0.02em", color: "#FFFFFF" }}>{s.title}</h3>
              <p style={{ margin: 0, fontSize: 14, lineHeight: "22px", color: "#B9CAD6" }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          marginTop: 16,
          borderRadius: 32,
          padding: "56px 32px 64px",
          background:
            "radial-gradient(700px 400px at 50% 0%, rgba(80,110,160,0.35), transparent 70%), linear-gradient(180deg, #0E1230 0%, #07071A 100%)",
        }}
      >
        <Starfield seed={29} count={40} heightPct={100} />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 24,
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: "clamp(36px, 5vw, 56px)", lineHeight: 0.95, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
              Proving Ground
            </h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: "24px", color: "#B9CAD6" }}>
              Every closed epoch becomes a public scorecard. Market makers win charters on depth they actually
              delivered, and nobody can fake the record.
            </p>
          </div>
          <Link
            href="/league"
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: 46,
              padding: "0 22px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "#FFFFFF",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            See the full league
          </Link>
        </div>
      </section>

      <footer
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "28px 24px 12px",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          gap: 16,
          fontSize: 14,
          color: "#8D9AAE",
        }}
      >
        <span>
          <span style={{ fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em", color: "#EEF4F1" }}>
            leadline
          </span>
          , built for the Uniswap Hook Incubator, cohort 11
        </span>
        <span style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <a href="https://github.com">Source code</a>
          <Link href="/charters/1/notices">Notices to Mariners</Link>
        </span>
      </footer>
    </div>
  );
}
