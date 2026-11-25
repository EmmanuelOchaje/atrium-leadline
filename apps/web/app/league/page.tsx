"use client";

import { useLeague } from "../../lib/useLeague";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function LeaguePage() {
  const { rows, loading } = useLeague(31337);

  return (
    <div className="min-h-screen bg-paper text-survey p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl mb-8">Proving Ground</h1>

        <div className="border border-rule rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-rule bg-shoal">
              <tr className="text-left">
                <th className="p-4">Market Maker</th>
                <th className="p-4">Avg Score</th>
                <th className="p-4">Time in Band</th>
                <th className="p-4">Epochs Closed</th>
                <th className="p-4">Charters</th>
                <th className="p-4">Handed Over</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.marketMaker} className="border-b border-rule hover:bg-shoal cursor-pointer last:border-0">
                  <td className="p-4">{shortAddr(row.marketMaker)}</td>
                  <td className="p-4 number">{(row.avgScoreBps / 100).toFixed(0)}%</td>
                  <td className="p-4 number">{row.avgSecondsInBandPct.toFixed(0)}%</td>
                  <td className="p-4 number">{row.epochs}</td>
                  <td className="p-4 number">{row.charterIds.size}</td>
                  <td className="p-4 number">{row.handoversAway}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && rows.length === 0 && (
          <p className="text-muted text-sm mt-6">
            No closed epochs yet. Run a charter for one epoch to appear here.
          </p>
        )}
      </div>
    </div>
  );
}
