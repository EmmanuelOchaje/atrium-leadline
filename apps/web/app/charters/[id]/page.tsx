"use client";

import { useCharter } from "../../../lib/useCharter";

function fmt(n: bigint, decimals: number): string {
  const whole = n / 10n ** BigInt(decimals);
  return whole.toLocaleString("en-US");
}

export default function ConsolePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const charterId = BigInt(id);
  const { charter, depth, score, isLoading, error } = useCharter(31337, charterId);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper text-survey p-6">
        <div className="max-w-7xl mx-auto text-muted">Loading charter #{id}…</div>
      </div>
    );
  }

  if (error || !charter) {
    return (
      <div className="min-h-screen bg-paper text-survey p-6">
        <div className="max-w-7xl mx-auto text-muted">
          Couldn't read charter #{id}. Is anvil running with `DeployLocal.s.sol` broadcast,
          and is the Console pointed at the right address book?
        </div>
      </div>
    );
  }

  const [below, above] = depth ?? [0n, 0n];
  const [scoreBps, projectedPayout] = score ?? [0, 0n];
  const target = charter.targetDepth;
  const epochsDone = charter.epochIndex;

  return (
    <div className="min-h-screen bg-paper text-survey p-6">
      <div className="max-w-7xl mx-auto">
        <header className="border-b border-rule pb-4 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl mb-2">Charter #{id}</h1>
              <p className="text-muted">
                Market maker <span className="text-survey">{charter.marketMaker}</span> ·
                Understudy <span className="text-survey">{charter.understudy}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-kelp mb-1">
                {charter.status === 1 ? "● Active" : charter.status === 2 ? "● Fallback" : "○ Recalled"}
              </div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>Epoch {epochsDone}</div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 border border-rule p-6 rounded">
            <h2 className="text-lg mb-4">The Sounder</h2>
            <div className="aspect-video bg-shoal rounded flex items-center justify-center text-muted">
              [Chart will render here]
            </div>
          </div>

          <div className="border border-rule p-6 rounded">
            <h3 className="text-lg mb-4">Chart Notes</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted">Score this epoch</div>
                <div className="text-3xl font-bold">{(scoreBps / 100).toFixed(0)}%</div>
              </div>
              <div className="border-t border-rule pt-4">
                <div className="text-sm text-muted mb-2">Below price</div>
                <div className="flex justify-between">
                  <span className="number">{fmt(below, 18)}</span>
                  <span className="text-muted">/{fmt(target, 18)}</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted mb-2">Above price</div>
                <div className="flex justify-between">
                  <span className="number">{fmt(above, 18)}</span>
                  <span className="text-muted">/{fmt(target, 18)}</span>
                </div>
              </div>
              <div className="border-t border-rule pt-4">
                <div className="text-sm text-muted mb-2">Time in band</div>
                <div className="flex justify-between">
                  <span className="number">{charter.secondsInBand}s</span>
                  <span className="text-muted">/ {charter.uptimeBps / 100}% target</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted mb-2">Projected pay</div>
                <div className="flex justify-between">
                  <span className="number text-kelp">{fmt(projectedPayout, 6)}</span>
                  <span className="text-muted">/ {fmt(charter.retainerPerEpoch, 6)} USDC</span>
                </div>
              </div>
              <div className="border-t border-rule pt-4 flex gap-2">
                <button className="flex-1 px-4 py-2 bg-survey text-paper rounded text-sm hover:bg-magenta transition">
                  Steer
                </button>
                <button className="flex-1 px-4 py-2 border border-survey rounded text-sm hover:border-magenta hover:text-magenta transition">
                  Ping
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
