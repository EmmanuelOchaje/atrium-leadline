"use client";

import { useAccount } from "wagmi";
import { Nav } from "../../../components/Nav";
import { Starfield } from "../../../components/Starfield";
import { useCharter, useCharterActions } from "../../../lib/useCharter";
import { useCharterEvents } from "../../../lib/useCharterEvents";
import { Sounder } from "./Sounder";

function fmt(n: bigint, decimals: number): string {
  const whole = n / 10n ** BigInt(decimals);
  return whole.toLocaleString("en-US");
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function describeEvent(eventName: string, args: Record<string, unknown>): string {
  switch (eventName) {
    case "Steered":
      return `range ${args.tickLower} – ${args.tickUpper}`;
    case "Pinged":
      return "heartbeat";
    case "Poked":
      return `moved to fallback range ${args.tickLower} – ${args.tickUpper}`;
    case "HandedOver":
      return `handed to ${shortAddr(String(args.to))}`;
    case "EpochClosed":
      return `score ${(Number(args.scoreBps) / 100).toFixed(0)}% · paid ${fmt(args.payout as bigint, 6)} · refund ${fmt(args.refund as bigint, 6)}`;
    case "Recalled":
      return `returned ${fmt(args.amount0 as bigint, 18)} / ${fmt(args.amount1 as bigint, 6)}`;
    default:
      return "";
  }
}

const STATUS: Record<number, { label: string; color: string }> = {
  0: { label: "None", color: "#9AAAB8" },
  1: { label: "Active", color: "#C6F36B" },
  2: { label: "Fallback", color: "#FFC878" },
  3: { label: "Recalled", color: "#FF9B9B" },
};

function Panel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 32,
        padding: 26,
        background: "linear-gradient(180deg, #11112C, #0A0A1F)",
        border: "1px solid rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ActionRow({
  title,
  body,
  cta,
  onClick,
  disabled,
  danger,
  primary,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  primary?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: 16,
        borderRadius: 20,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 3, flexGrow: 1, minWidth: 0 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#FFFFFF" }}>{title}</span>
        <span style={{ fontSize: 13, lineHeight: "18px", color: "#9AAAB8" }}>{body}</span>
      </span>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        style={{
          flexShrink: 0,
          height: 40,
          padding: "0 18px",
          borderRadius: 999,
          border: danger ? "1px solid rgba(255,140,140,0.5)" : primary ? 0 : "1px solid rgba(255,255,255,0.2)",
          background: danger ? "rgba(255,90,90,0.08)" : primary ? "#C6F36B" : "transparent",
          color: danger ? "#FF9B9B" : primary ? "#0C1A04" : "#FFFFFF",
          fontSize: 14,
          fontWeight: primary || danger ? 600 : 400,
          opacity: disabled ? 0.4 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        {cta}
      </button>
    </div>
  );
}

export default function ConsolePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const charterId = BigInt(id);
  const { charter, depth, score, tick, isLoading, error } = useCharter(31337, charterId);
  const events = useCharterEvents(31337, charterId);
  const { ping, steer, handover, recall, isPending } = useCharterActions(31337, charterId);
  const { address, isConnected } = useAccount();

  if (isLoading) {
    return (
      <div style={{ background: "#06061A", minHeight: "100vh", padding: 16 }}>
        <Nav />
        <p style={{ color: "#9AAAB8", padding: "0 16px" }}>Loading charter #{id}…</p>
      </div>
    );
  }

  if (error || !charter) {
    return (
      <div style={{ background: "#06061A", minHeight: "100vh", padding: 16 }}>
        <Nav />
        <p style={{ color: "#9AAAB8", padding: "0 16px" }}>
          Couldn&rsquo;t read charter #{id}. Is anvil running with DeployLocal.s.sol broadcast, and is the Console
          pointed at the right address book?
        </p>
      </div>
    );
  }

  const [below, above] = depth ?? [0n, 0n];
  const [scoreBps, projectedPayout] = score ?? [0, 0n];
  const target = charter.targetDepth;
  const status = STATUS[charter.status] ?? STATUS[0];

  const isIssuer = isConnected && address?.toLowerCase() === charter.issuer.toLowerCase();
  const isMarketMaker = isConnected && address?.toLowerCase() === charter.marketMaker.toLowerCase();

  // epochIndex = epochs already closed; estimate remaining from the current
  // epoch's window against the charter's term end.
  const remaining = Math.max(
    0,
    Math.ceil((Number(charter.termEnd) - Number(charter.epochStart)) / (charter.epochLength || 1))
  );
  const totalEpochs = charter.epochIndex + Math.max(remaining, 1);
  const epochCells = Array.from({ length: Math.max(totalEpochs, 1) }, (_, i) => i < charter.epochIndex);

  return (
    <div style={{ background: "#06061A", padding: 16, minHeight: "100vh" }}>
      <Nav />

      <section
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 32,
          background:
            "radial-gradient(760px 420px at 74% 112%, rgba(198,243,107,0.45) 0%, rgba(111,226,177,0.4) 30%, rgba(25,110,118,0.3) 58%, rgba(12,16,52,0) 82%), linear-gradient(180deg, #0B0926 0%, #101A44 50%, #0D3346 85%, #10473F 100%)",
        }}
      >
        <Starfield seed={5} count={40} />

        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 24, padding: "40px 40px 32px" }}>
          <div style={{ flex: "1 1 440px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.16)",
                  fontSize: 13.5,
                  color: status.color,
                }}
              >
                <span className="ll-now" style={{ width: 7, height: 7, borderRadius: "50%", background: status.color, boxShadow: `0 0 10px ${status.color}` }} />
                {status.label}
              </span>
              <span style={{ fontSize: 13.5, color: "#9AAAB8" }}>
                Grace {charter.graceSeconds}s · epoch {charter.epochLength}s
              </span>
            </div>
            <h1 style={{ margin: 0, fontWeight: 700, fontSize: "clamp(36px, 4.5vw, 56px)", lineHeight: 0.95, letterSpacing: "-0.035em", color: "#FFFFFF" }}>
              Charter #{id}
            </h1>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span style={pillStyle}>
                <span style={{ color: "#9AAAB8" }}>Market maker</span>
                {shortAddr(charter.marketMaker)}
              </span>
              <span style={pillStyle}>
                <span style={{ color: "#9AAAB8" }}>Understudy</span>
                {shortAddr(charter.understudy)}
              </span>
              <span style={pillStyle}>
                <span style={{ color: "#9AAAB8" }}>Issuer</span>
                {shortAddr(charter.issuer)}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
              <span style={{ fontSize: 14, color: "#B9CAD6" }}>Proof of Depth, epoch {charter.epochIndex}</span>
              <span style={{ fontWeight: 300, fontSize: "clamp(64px, 8vw, 112px)", lineHeight: 0.9, letterSpacing: "-0.04em", color: "#FFFFFF" }}>
                {(scoreBps / 100).toFixed(0)}
                <span style={{ color: "#7C8CA3", fontSize: "0.5em" }}>%</span>
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 14, color: "#B9CAD6" }}>
              <span>
                Projected pay{" "}
                <strong style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontSize: 20, fontWeight: 500, color: "#FFFFFF" }}>
                  {fmt(projectedPayout, 6)}
                </strong>{" "}
                of {fmt(charter.retainerPerEpoch, 6)}
              </span>
              <span>
                Fees collected{" "}
                <strong style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontSize: 20, fontWeight: 500, color: "#FFFFFF" }}>
                  {fmt(charter.fees0, 18)} / {fmt(charter.fees1, 6)}
                </strong>
              </span>
              <span>
                Time in band{" "}
                <strong style={{ fontFamily: "'Inter Tight', Inter, sans-serif", fontSize: 20, fontWeight: 500, color: "#FFFFFF" }}>
                  {charter.secondsInBand}s
                </strong>{" "}
                of {charter.uptimeBps / 100}% target
              </span>
            </div>
          </div>
        </div>

        <div style={{ position: "relative", padding: "0 40px 28px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, color: "#B9CAD6" }}>
            <span>
              Epoch {charter.epochIndex} of ~{totalEpochs}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${epochCells.length}, minmax(0, 1fr))`, gap: 5 }}>
            {epochCells.map((closed, i) => (
              <div
                key={i}
                title={closed ? `Epoch ${i}, closed` : `Epoch ${i}, pending`}
                style={{
                  height: 8,
                  borderRadius: 3,
                  background: closed ? "#C6F36B" : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
        </div>
      </section>

      <section style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
        <Panel style={{ flex: "2 1 640px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 28, letterSpacing: "-0.03em", color: "#FFFFFF" }}>The Sounder</h2>
            <span style={{ fontSize: 13, color: "#9AAAB8" }}>Deeper water means more liquidity delivered.</span>
          </div>
          <Sounder tick={tick} tickLower={charter.tickLower} tickUpper={charter.tickUpper} bandTicks={charter.bandTicks} below={below} above={above} target={target} />
        </Panel>

        <aside
          aria-label="Actions"
          style={{
            flex: "1 1 340px",
            position: "relative",
            overflow: "hidden",
            borderRadius: 32,
            padding: 26,
            background: "radial-gradient(420px 240px at 100% 0%, rgba(198,243,107,0.16), transparent 70%), linear-gradient(180deg, #121436, #0B0B22)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: "#9AAAB8" }}>Actions</span>
            <h2 style={{ margin: 0, fontWeight: 700, fontSize: 24, letterSpacing: "-0.03em", color: "#FFFFFF" }}>
              {isIssuer ? "You are the issuer" : isMarketMaker ? "You are the market maker" : "Connect to act"}
            </h2>
          </div>

          {isMarketMaker && (
            <>
              <ActionRow
                title="Steer"
                body="Re-send the current range as a fresh heartbeat."
                cta="Steer"
                onClick={() => steer(charter.tickLower, charter.tickUpper)}
                disabled={isPending}
                primary
              />
              <ActionRow title="Ping" body="Send a heartbeat without moving the range." cta="Ping" onClick={() => ping()} disabled={isPending} />
            </>
          )}

          {isIssuer && (
            <>
              <ActionRow
                title="Hand over"
                body={`Give the charter to the understudy (${shortAddr(charter.understudy)}) in one transaction.`}
                cta="Hand over"
                onClick={() => handover()}
                disabled={isPending}
                primary
              />
              <ActionRow
                title="Recall"
                body="Take back every token and fee. Nothing can block it."
                cta="Recall"
                onClick={() => recall()}
                disabled={isPending}
                danger
              />
            </>
          )}

          {!isIssuer && !isMarketMaker && (
            <p style={{ fontSize: 13.5, color: "#9AAAB8", lineHeight: "20px" }}>
              Connect the market maker&rsquo;s or issuer&rsquo;s wallet to steer, ping, hand over or recall this
              charter.
            </p>
          )}
        </aside>
      </section>

      <Panel style={{ marginTop: 16 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 600, color: "#FFFFFF" }}>Log</h3>
        {events.length === 0 ? (
          <p style={{ color: "#9AAAB8", fontSize: 14 }}>No events yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5 }}>
            {events.map((e) => (
              <div
                key={`${e.transactionHash}-${e.logIndex}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  color: "#9AAAB8",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                  paddingBottom: 10,
                }}
              >
                <span>block {e.blockNumber.toString()}</span>
                <span style={{ color: "#FFFFFF" }}>{e.eventName}</span>
                <span style={{ flex: 1 }}>{describeEvent(e.eventName, e.args)}</span>
                <span style={{ color: "#B7F5D8" }}>{shortAddr(e.transactionHash)}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

const pillStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  fontSize: 13.5,
};
