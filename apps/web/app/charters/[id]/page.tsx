"use client";

import { use } from "react";

export default function ConsolePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="min-h-screen bg-paper text-survey p-6">
      <div className="max-w-7xl mx-auto">
        <header className="border-b border-rule pb-4 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl mb-2">TIDE / USDC Charter</h1>
              <p className="text-muted">
                Market maker <span className="text-survey">Leeward Desk</span> (0x7099…79C8) ·
                Understudy <span className="text-survey">Saltmarsh</span> (0x3C44…93BC)
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-kelp mb-1">● Live</div>
              <div className="text-sm text-muted">steered 12 s ago</div>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>Epochs ▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯  epoch 7 of 30 · closes in 1:24</div>
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
                <div className="text-3xl font-bold">83%</div>
              </div>
              <div className="border-t border-rule pt-4">
                <div className="text-sm text-muted mb-2">Below price</div>
                <div className="flex justify-between">
                  <span className="number">27 400</span>
                  <span className="text-muted">/25 000</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted mb-2">Above price</div>
                <div className="flex justify-between">
                  <span className="number">21 900</span>
                  <span className="text-muted">/25 000</span>
                </div>
              </div>
              <div className="border-t border-rule pt-4">
                <div className="text-sm text-muted mb-2">Time in band</div>
                <div className="flex justify-between">
                  <span className="number">86%</span>
                  <span className="text-muted">/ 90% target</span>
                </div>
              </div>
              <div>
                <div className="text-sm text-muted mb-2">Projected pay</div>
                <div className="flex justify-between">
                  <span className="number text-kelp">415</span>
                  <span className="text-muted">/ 500 USDC</span>
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

        <div className="border border-rule p-6 rounded">
          <h3 className="text-lg mb-4">Log</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-muted border-b border-rule pb-2">
              <span>12 s</span>
              <span>Steered</span>
              <span>Leeward Desk</span>
              <span>range 0.0952 – 0.1008 · liquidity 1.2e21</span>
              <span className="text-contour cursor-pointer">tx ↗</span>
            </div>
            <div className="flex justify-between text-muted border-b border-rule pb-2">
              <span>14 s</span>
              <span>Swap</span>
              <span>0xf39F…2266</span>
              <span>bought 1,200 TIDE · depth ↓ below</span>
              <span className="text-contour cursor-pointer">tx ↗</span>
            </div>
            <div className="flex justify-between text-muted pb-2">
              <span>2 m</span>
              <span>Epoch 6 closed</span>
              <span>score 91% · paid 455 USDC</span>
              <span>refund 45</span>
              <span className="text-contour cursor-pointer">tx ↗</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
