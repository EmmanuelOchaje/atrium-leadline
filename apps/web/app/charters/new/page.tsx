"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount, useConnect } from "wagmi";
import { pctToTicks, alignDown, alignUp } from "@leadline/sdk";
import { useCreateCharter } from "../../../lib/useCreateCharter";

const TICK_SPACING = 60;

export default function NewCharterPage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { create, step, charterId, error } = useCreateCharter(31337);

  const [formData, setFormData] = useState({
    poolId: "TIDE/USDC",
    tide: "1000",
    usdc: "100000",
    bandPercent: "2",
    targetDepth: "25000",
    epochLength: "120",
    numEpochs: "30",
    graceSeconds: "45",
    uptimeTarget: "90",
    retainer: "500",
    marketMaker: "",
    understudy: "",
  });

  const isBusy = step === "approve0" || step === "approve1" || step === "create";

  async function handleCreate() {
    const bandTicks = Math.abs(pctToTicks(Number(formData.bandPercent)));
    const tickLower = alignDown(-bandTicks, TICK_SPACING);
    const tickUpper = alignUp(bandTicks, TICK_SPACING);

    await create({
      tideAmountHuman: formData.tide,
      usdcAmountHuman: formData.usdc,
      tickLower,
      tickUpper,
      bandTicks,
      minWidth: TICK_SPACING * 2,
      maxWidth: bandTicks * 20,
      fallbackHalfWidth: bandTicks * 6,
      targetDepthUsdcHuman: formData.targetDepth,
      uptimeBps: Math.round(Number(formData.uptimeTarget) * 100),
      epochLength: Number(formData.epochLength),
      graceSeconds: Number(formData.graceSeconds),
      numEpochs: Number(formData.numEpochs),
      retainerPerEpochUsdcHuman: formData.retainer,
      marketMaker: formData.marketMaker as `0x${string}`,
      understudy:
        (formData.understudy || "0x0000000000000000000000000000000000000000") as `0x${string}`,
    });
  }

  useEffect(() => {
    if (step === "done" && charterId !== null) {
      router.push(`/charters/${charterId}`);
    }
  }, [step, charterId, router]);

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
            <Link href="/charters/new" className="text-survey font-semibold">
              Write a charter
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-semibold mb-8">Write a Charter</h1>

        <div className="grid grid-cols-2 gap-8">
          {/* Form */}
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-4">Pool and Inventory</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted block mb-2">Pool</label>
                  <select className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey">
                    <option>TIDE / USDC</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">TIDE amount</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.tide}
                    onChange={(e) => setFormData({ ...formData, tide: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">USDC amount</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.usdc}
                    onChange={(e) => setFormData({ ...formData, usdc: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Depth Terms</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted block mb-2">Band width (±%)</label>
                  <input
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.5"
                    className="w-full"
                    value={formData.bandPercent}
                    onChange={(e) => setFormData({ ...formData, bandPercent: e.target.value })}
                  />
                  <div className="text-sm text-muted mt-2">±{formData.bandPercent}% (≈ 198 ticks)</div>
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">Target depth per side (USDC)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.targetDepth}
                    onChange={(e) => setFormData({ ...formData, targetDepth: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Time Terms</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted block mb-2">Epoch length (seconds)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.epochLength}
                    onChange={(e) => setFormData({ ...formData, epochLength: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">Number of epochs</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.numEpochs}
                    onChange={(e) => setFormData({ ...formData, numEpochs: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">Uptime target (%)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.uptimeTarget}
                    onChange={(e) => setFormData({ ...formData, uptimeTarget: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">Pay</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted block mb-2">Retainer per epoch (USDC)</label>
                  <input
                    type="number"
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.retainer}
                    onChange={(e) => setFormData({ ...formData, retainer: e.target.value })}
                  />
                </div>
                <div className="bg-shoal p-4 rounded text-sm">
                  <p>Escrow <strong className="number">{(Number(formData.retainer) * Number(formData.numEpochs)).toLocaleString()} USDC</strong> for {formData.numEpochs} epochs.</p>
                  <p className="text-muted mt-2">The market maker earns up to {formData.retainer} USDC per epoch, in proportion to depth delivered.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-4">People</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted block mb-2">Market maker</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.marketMaker}
                    onChange={(e) => setFormData({ ...formData, marketMaker: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm text-muted block mb-2">Understudy (optional)</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    className="w-full px-4 py-2 border border-rule rounded bg-paper text-survey"
                    value={formData.understudy}
                    onChange={(e) => setFormData({ ...formData, understudy: e.target.value })}
                  />
                </div>
              </div>
            </section>

            {!isConnected ? (
              <button
                className="w-full px-6 py-3 bg-survey text-paper rounded hover:bg-magenta transition font-semibold"
                onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              >
                Connect wallet to create
              </button>
            ) : (
              <button
                disabled={isBusy || !formData.marketMaker}
                onClick={handleCreate}
                className="w-full px-6 py-3 bg-survey text-paper rounded hover:bg-magenta transition font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {step === "approve0" && "Approving TIDE…"}
                {step === "approve1" && "Approving USDC…"}
                {step === "create" && "Creating charter…"}
                {(step === "idle" || step === "error") && "Create Charter"}
              </button>
            )}
            {error && (
              <p className="text-rust text-sm mt-2">{error.message.split("\n")[0]}</p>
            )}
          </div>

          {/* Preview */}
          <div className="sticky top-6 h-fit">
            <h2 className="text-lg font-semibold mb-4">Preview</h2>
            <div className="border border-rule p-6 rounded bg-shoal">
              <div className="aspect-square bg-paper rounded flex items-center justify-center text-muted mb-4">
                [Live Sounder preview will render here]
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Initial range</span>
                  <span className="number">0.0952 – 0.1008</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Band</span>
                  <span className="number">±{formData.bandPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total term</span>
                  <span className="number">{(Number(formData.epochLength) * Number(formData.numEpochs) / 3600).toFixed(1)} hours</span>
                </div>
                <div className="flex justify-between pt-3 border-t border-rule">
                  <span className="text-muted">Total escrow</span>
                  <span className="number text-magenta">{(Number(formData.retainer) * Number(formData.numEpochs)).toLocaleString()} USDC</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
