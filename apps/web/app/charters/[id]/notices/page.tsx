"use client";

import { Nav } from "../../../../components/Nav";
import { useCharter } from "../../../../lib/useCharter";
import { useNotices, type NoticeResult } from "../../../../lib/useNotices";

const NOTICES = [
  { num: 1, title: "Withdraw the inventory to the market maker", replays: "Movement (2025)", expect: "Reverted NotIssuer — I1 Custody" },
  { num: 2, title: "Pull liquidity straight from the pool", replays: "Visor, Concentric key thefts", expect: "Reverted: the position belongs to the hook — I1" },
  { num: 3, title: "Steer the range far from the price", replays: "Gamma (Jan 2024)", expect: "Reverted RangeMustContainPrice — I4" },
  { num: 4, title: "Steer a razor-thin range", replays: "Gamma", expect: "Reverted RangeWidthOutOfBounds — I4" },
  { num: 5, title: "Call the hook's unlock callback directly", replays: "Cork (May 2025, ~$11–12M)", expect: "Reverted UnauthorizedCallback — I3" },
  { num: 6, title: "Wash-trade swaps to pad the score", replays: "Score gaming", expect: "Ran: fees moved, Proof of Depth didn't — I7" },
  { num: 7, title: "Donate to the range", replays: "Score gaming", expect: "Reverted DonationsDisabled — I7" },
  { num: 8, title: "Poke while the market maker is alive", replays: "Griefing", expect: "Reverted HeartbeatNotStale — I9" },
  { num: 9, title: "Settle the same epoch twice", replays: "Popsicle (Aug 2021, ~$20M)", expect: "Second settle changes nothing — I8" },
  { num: 10, title: "Route through an attacker-made pool", replays: "Safe/rsETH module (Sept 2026, ~$7.7M)", expect: "Swaps run; charter state untouched — I2" },
  { num: 11, title: "Block the issuer's recall", replays: "Arcadia (Jul 2025, ~$3.6M)", expect: "Market maker's contract reverts on receive; recall still succeeds — I10" },
];

function fmt(n: bigint): string {
  return (Number(n) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function Stamp({ result }: { result?: NoticeResult }) {
  if (!result) return null;
  const color = result.outcome === "blocked" ? "#2F6E46" : result.outcome === "ran" ? "#1B3B55" : result.outcome === "live-only" ? "#A86B14" : "#A33A2B";
  const label = result.outcome === "blocked" ? "Blocked" : result.outcome === "ran" ? "Ran" : result.outcome === "live-only" ? "Needs a test, not a button" : "Unexpected";
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      <span
        className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-xs font-semibold w-fit"
        style={{ color, background: `${color}1A`, border: `1px solid ${color}55` }}
      >
        {label}
      </span>
      <p className="text-xs text-muted max-w-sm">{result.message}</p>
      {result.before && result.after && (
        <p className="text-xs text-muted max-w-sm">
          Depth before: {fmt(result.before.below)} / {fmt(result.before.above)} — after: {fmt(result.after.below)} / {fmt(result.after.above)}
        </p>
      )}
    </div>
  );
}

export default function NoticesPage({ params }: { params: { id: string } }) {
  const charterId = BigInt(params.id);
  const { charter, tick, isLoading } = useCharter(31337, charterId);
  const { run, results, running } = useNotices(charterId, charter, tick);

  const blockedOrRan = Object.values(results).filter((r) => r.outcome === "blocked" || r.outcome === "ran").length;

  return (
    <div className="composer-page">
      <Nav />

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Notices to Mariners</h1>
          <p className="text-muted max-w-2xl">
            Each notice replays a real exploit or a way to game the score, against charter #{params.id} on the
            live local chain. Run it and see what actually happens — not a mockup.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-rule">
          <span>
            <strong className="text-2xl font-medium">{blockedOrRan}</strong> of {NOTICES.length} notices run, held
          </span>
          {isLoading && <span className="text-sm text-muted">Loading charter…</span>}
        </div>

        <ol className="list-none flex flex-col">
          {NOTICES.map((n) => {
            const result = results[n.num];
            const isLive = n.num <= 9;
            return (
              <li key={n.num} className="flex flex-wrap gap-6 py-5 border-b border-rule items-start">
                <span className="w-12 text-3xl" style={{ color: "#3F7FAF" }} aria-hidden="true">
                  {String(n.num).padStart(2, "0")}
                </span>
                <div className="flex-[999_1_420px] min-w-0 flex flex-col gap-1.5">
                  <h2 className="text-lg font-semibold">{n.title}</h2>
                  <span className="text-sm text-muted">Replays {n.replays}</span>
                  <Stamp result={result} />
                </div>
                <div className="flex-[1_1_340px] flex flex-col gap-2 items-start">
                  <button
                    type="button"
                    onClick={() => run(n.num)}
                    disabled={!charter || running === n.num || !isLive && result !== undefined}
                    title={isLive ? "Runs a real transaction against the local chain" : "Points to the automated test instead"}
                    className="h-11 px-4 rounded-md border border-rule bg-white text-survey text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {running === n.num ? "Running…" : isLive ? "Run attack" : "See the test"}
                  </button>
                  <span className="text-xs text-muted">Expect: {n.expect}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}
