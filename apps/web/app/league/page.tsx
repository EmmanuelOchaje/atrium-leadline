"use client";

export default function LeaguePage() {
  return (
    <div className="min-h-screen bg-paper text-survey p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl mb-8">Proving Ground</h1>

        <div className="border border-rule rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-rule bg-shoal">
              <tr className="text-left">
                <th className="p-4">Market Maker</th>
                <th className="p-4">Delivered</th>
                <th className="p-4">Time in Band</th>
                <th className="p-4">Missed Epochs</th>
                <th className="p-4">Charters</th>
                <th className="p-4">Last 12 Epochs</th>
                <th className="p-4">Handed Over</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-rule hover:bg-shoal cursor-pointer">
                <td className="p-4">Leeward Desk<br/><span className="text-muted">0x7099…79C8</span></td>
                <td className="p-4 number">87%</td>
                <td className="p-4">91%</td>
                <td className="p-4">0</td>
                <td className="p-4">3 / 3</td>
                <td className="p-4">[████████████]</td>
                <td className="p-4">0</td>
              </tr>
              <tr className="border-b border-rule hover:bg-shoal cursor-pointer">
                <td className="p-4">Saltmarsh Liquidity<br/><span className="text-muted">0x3C44…93BC</span></td>
                <td className="p-4 number">72%</td>
                <td className="p-4">84%</td>
                <td className="p-4">2</td>
                <td className="p-4">2 / 2</td>
                <td className="p-4">[██████████░░]</td>
                <td className="p-4">1</td>
              </tr>
              <tr className="hover:bg-shoal cursor-pointer">
                <td className="p-4">Northline Markets<br/><span className="text-muted">0x8899…CCDD</span></td>
                <td className="p-4 number">91%</td>
                <td className="p-4">95%</td>
                <td className="p-4">0</td>
                <td className="p-4">1 / 1</td>
                <td className="p-4">[████████████]</td>
                <td className="p-4">0</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-muted text-sm mt-6">
          No closed epochs yet. Run a charter for one epoch to appear here.
        </p>
      </div>
    </div>
  );
}
