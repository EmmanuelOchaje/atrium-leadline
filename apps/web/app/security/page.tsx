"use client";

import Link from "next/link";

const NOTICES = [
  {
    num: "01",
    title: "Withdraw the inventory to the market maker",
    replays: "Movement (2025)",
    expect: "Reverted NotIssuer — I1 Custody",
  },
  {
    num: "02",
    title: "Pull liquidity straight from the pool",
    replays: "Visor, Concentric key thefts",
    expect: "Reverted in PoolManager: the position belongs to the hook — I1",
  },
  {
    num: "03",
    title: "Steer the range far from the price",
    replays: "Gamma (Jan 2024)",
    expect: "Reverted RangeMustContainPrice — I4",
  },
  {
    num: "04",
    title: "Steer a razor-thin range",
    replays: "Gamma",
    expect: "Reverted RangeWidthOutOfBounds — I4",
  },
  {
    num: "05",
    title: "Call the hook's unlock callback directly",
    replays: "Cork (May 2025, ~$11–12M)",
    expect: "Reverted UnauthorizedCallback — I3",
  },
  {
    num: "06",
    title: "Wash-trade 100 swaps to pad the score",
    replays: "Score gaming",
    expect: "Ran: fees +X, Proof of Depth unchanged — I7",
  },
  {
    num: "07",
    title: "Donate to the range",
    replays: "Score gaming",
    expect: "Reverted DonationsDisabled — I7",
  },
  {
    num: "08",
    title: "Poke while the market maker is alive",
    replays: "Griefing",
    expect: "Reverted HeartbeatNotStale — I9",
  },
  {
    num: "09",
    title: "Settle the same epoch twice",
    replays: "Popsicle (Aug 2021, ~$20M)",
    expect: "Second settle changes nothing — I8",
  },
  {
    num: "10",
    title: "Route through an attacker-made pool",
    replays: "Safe/rsETH module (Sept 2026, ~$7.7M)",
    expect: "Swaps run; charter state untouched — I2",
  },
  {
    num: "11",
    title: "Block the issuer's recall",
    replays: "Arcadia (Jul 2025, ~$3.6M)",
    expect: "Market maker's contract reverts on receive; recall still succeeds — I10",
  },
];

export default function SecurityPage() {
  return (
    <div className="composer-page">
      <header className="border-b border-rule">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-8">
          <Link href="/" className="text-xl font-semibold text-survey">
            leadline
          </Link>
          <nav aria-label="Main" className="flex gap-6 text-sm flex-grow">
            <Link href="/charters/1" className="text-muted">
              Charters
            </Link>
            <Link href="/league" className="text-muted">
              Proving Ground
            </Link>
            <Link href="/security" className="text-survey font-semibold">
              Security
            </Link>
            <Link href="/charters/new" className="text-muted">
              Write a charter
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 flex flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Notices to Mariners</h1>
          <p className="text-muted max-w-2xl">
            Each notice replays a real exploit or a way to game the score. In the finished build, every one of
            these runs live against the deployed hook and either gets refused or provably changes nothing.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-rule">
          <span>
            <strong className="text-2xl font-medium">0</strong> of {NOTICES.length} notices wired up yet
          </span>
          <span className="text-sm text-muted">
            This is a design preview — the red-team Foundry suite (<code>test/attacks/RedTeam.t.sol</code>) is an
            L3 item, not yet built.
          </span>
        </div>

        <ol className="list-none flex flex-col">
          {NOTICES.map((n) => (
            <li key={n.num} className="flex flex-wrap gap-6 py-5 border-b border-rule items-start">
              <span className="w-12 text-3xl" style={{ color: "#3F7FAF" }} aria-hidden="true">
                {n.num}
              </span>
              <div className="flex-[999_1_420px] min-w-0 flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold">{n.title}</h2>
                <span className="text-sm text-muted">Replays {n.replays}</span>
              </div>
              <div className="flex-[1_1_340px] flex flex-col gap-2 items-start">
                <button
                  type="button"
                  disabled
                  title="Not implemented yet — see L3 in BUILD.md"
                  className="h-11 px-4 rounded-md border border-rule bg-white text-muted text-sm font-semibold cursor-not-allowed"
                >
                  Run attack
                </button>
                <span className="text-xs text-muted">Expect: {n.expect}</span>
              </div>
            </li>
          ))}
        </ol>
      </main>
    </div>
  );
}
