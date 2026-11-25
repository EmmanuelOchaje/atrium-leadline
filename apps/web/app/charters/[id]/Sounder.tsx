"use client";

/**
 * A cross-section of the charter's position: the steered range, the depth
 * band around price, and where the current tick sits inside both.
 */
export function Sounder({
  tick,
  tickLower,
  tickUpper,
  bandTicks,
}: {
  tick: number | undefined;
  tickLower: number;
  tickUpper: number;
  bandTicks: number;
}) {
  if (tick === undefined) {
    return (
      <div className="aspect-video bg-shoal rounded flex items-center justify-center text-muted">
        Waiting for price…
      </div>
    );
  }

  const bandLo = tick - bandTicks;
  const bandHi = tick + bandTicks;
  const lo = Math.min(tickLower, bandLo);
  const hi = Math.max(tickUpper, bandHi);
  const span = hi - lo || 1;
  const pct = (t: number) => ((t - lo) / span) * 100;

  const inBand = tick >= tickLower - bandTicks && tick <= tickUpper + bandTicks;

  return (
    <div className="aspect-video bg-shoal rounded p-6 flex flex-col justify-center gap-6">
      <svg viewBox="0 0 100 20" className="w-full" preserveAspectRatio="none">
        {/* position range */}
        <rect
          x={pct(tickLower)}
          y={6}
          width={Math.max(pct(tickUpper) - pct(tickLower), 0.5)}
          height={8}
          fill="var(--contour)"
          opacity={0.35}
        />
        {/* depth band */}
        <rect
          x={pct(bandLo)}
          y={9}
          width={Math.max(pct(bandHi) - pct(bandLo), 0.5)}
          height={2}
          fill="var(--kelp)"
          opacity={0.6}
        />
        {/* current tick */}
        <line
          x1={pct(tick)}
          x2={pct(tick)}
          y1={2}
          y2={18}
          stroke={inBand ? "var(--kelp)" : "var(--rust)"}
          strokeWidth={0.8}
        />
      </svg>
      <div className="flex justify-between text-sm text-muted">
        <span>tick {tickLower}</span>
        <span className={inBand ? "text-kelp" : "text-rust"}>tick {tick}</span>
        <span>tick {tickUpper}</span>
      </div>
    </div>
  );
}
