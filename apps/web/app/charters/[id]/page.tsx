"use client";

import { useAccount, useConnect } from "wagmi";
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

export default function ConsolePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const charterId = BigInt(id);
  const { charter, depth, score, tick, isLoading, error } = useCharter(31337, charterId);
  const events = useCharterEvents(31337, charterId);
  const { ping, steer, isPending } = useCharterActions(31337, charterId);
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

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
  const isMarketMaker = isConnected && address?.toLowerCase() === charter.marketMaker.toLowerCase();

  return (
    <div className="min-h-screen bg-paper text-survey p-6">
      <div className="max-w-7xl mx-auto">
        <header className="border-b border-rule pb-4 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl mb-2">Charter #{id}</h1>
              <p className="text-muted">
                Market maker <span className="text-survey">{shortAddr(charter.marketMaker)}</span> ·
                Understudy <span className="text-survey">{shortAddr(charter.understudy)}</span>
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-kelp mb-1">
                {charter.status === 1 ? "● Active" : charter.status === 2 ? "● Fallback" : "○ Recalled"}
              </div>
              {!isConnected && (
                <button
                  className="text-sm text-contour hover:text-magenta"
                  onClick={() => connectors[0] && connect({ connector: connectors[0] })}
                >
                  Connect wallet
                </button>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>Epoch {charter.epochIndex}</div>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2 border border-rule p-6 rounded">
            <h2 className="text-lg mb-4">The Sounder</h2>
            <Sounder
              tick={tick}
              tickLower={charter.tickLower}
              tickUpper={charter.tickUpper}
              bandTicks={charter.bandTicks}
            />
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
                <button
                  disabled={!isMarketMaker || isPending}
                  onClick={() => steer(charter.tickLower, charter.tickUpper)}
                  title={isMarketMaker ? "Re-steer the current range" : "Connect as the market maker to steer"}
                  className="flex-1 px-4 py-2 bg-survey text-paper rounded text-sm hover:bg-magenta transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Steer
                </button>
                <button
                  disabled={!isMarketMaker || isPending}
                  onClick={() => ping()}
                  title={isMarketMaker ? "Send a heartbeat" : "Connect as the market maker to ping"}
                  className="flex-1 px-4 py-2 border border-survey rounded text-sm hover:border-magenta hover:text-magenta transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ping
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-rule p-6 rounded">
          <h3 className="text-lg mb-4">Log</h3>
          {events.length === 0 ? (
            <p className="text-muted text-sm">No events yet.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {events.map((e) => (
                <div
                  key={`${e.transactionHash}-${e.logIndex}`}
                  className="flex justify-between text-muted border-b border-rule pb-2 last:border-0 gap-4"
                >
                  <span>block {e.blockNumber.toString()}</span>
                  <span>{e.eventName}</span>
                  <span className="flex-1">{describeEvent(e.eventName, e.args)}</span>
                  <span className="text-contour">{shortAddr(e.transactionHash)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
