"use client";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-paper text-survey">
      <header className="border-b border-rule p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl">Leadline</h1>
          <nav className="flex gap-8 text-base">
            <a href="/" className="hover:text-magenta">Charters</a>
            <a href="/league" className="hover:text-magenta">Proving Ground</a>
            <a href="/charters/new" className="hover:text-magenta">Write a Charter</a>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="mb-24">
          <h2 className="text-4xl mb-6">Let the pool prove the depth</h2>
          <p className="text-lg text-muted max-w-2xl mb-8">
            Leadline holds a token issuer's liquidity in a Uniswap v4 hook.
            Market makers can steer it but never take it, and they're paid only
            for the depth they deliver.
          </p>
          <div className="flex gap-4">
            <button className="px-6 py-3 bg-survey text-paper rounded-md hover:bg-magenta transition">
              Open the Live Charter
            </button>
            <button className="px-6 py-3 border border-survey text-survey rounded-md hover:border-magenta hover:text-magenta transition">
              Write a Charter
            </button>
          </div>
        </section>

        <section className="mb-24">
          <h3 className="text-2xl mb-12">How it works</h3>
          <div className="grid grid-cols-4 gap-8">
            <div>
              <div className="text-3xl font-bold text-magenta mb-4">1</div>
              <h4 className="font-semibold mb-2">Write a charter</h4>
              <p className="text-sm text-muted">
                Set depth targets, range bounds, and terms.
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-magenta mb-4">2</div>
              <h4 className="font-semibold mb-2">Market maker steers</h4>
              <p className="text-sm text-muted">
                They move the range to follow price.
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-magenta mb-4">3</div>
              <h4 className="font-semibold mb-2">Pool measures depth</h4>
              <p className="text-sm text-muted">
                Every swap updates Proof of Depth.
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-magenta mb-4">4</div>
              <h4 className="font-semibold mb-2">Pay follows delivery</h4>
              <p className="text-sm text-muted">
                Score determines the payout each epoch.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-24">
          <h3 className="text-2xl mb-8">Why it has to be a hook</h3>
          <ul className="space-y-4 text-muted">
            <li className="flex gap-4">
              <span className="text-magenta font-bold">•</span>
              <span>Scores every swap exactly, inside the pool.</span>
            </li>
            <li className="flex gap-4">
              <span className="text-magenta font-bold">•</span>
              <span>Owns the position so the market maker can steer but never withdraw.</span>
            </li>
            <li className="flex gap-4">
              <span className="text-magenta font-bold">•</span>
              <span>Blocks donations that would pad the depth numbers.</span>
            </li>
          </ul>
        </section>
      </main>

      <footer className="border-t border-rule mt-24 py-12 text-center text-sm text-muted">
        <p>Built for UHI11 · <a href="https://github.com">GitHub</a></p>
      </footer>
    </div>
  );
}
