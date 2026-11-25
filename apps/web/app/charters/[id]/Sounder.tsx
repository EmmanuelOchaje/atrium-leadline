"use client";

const W = 900;
const H = 380;
const AXIS_L = 40;
const AXIS_R = 860;
const TOP = 70;
const BOTTOM = 280;

/** tick -> price ratio, relative to an arbitrary tick0 (we only need relative spacing here). */
function tickToRel(tick: number, tick0: number): number {
  return Math.pow(1.0001, tick - tick0);
}

/**
 * The Sounder: a cross-section of the charter's position, its depth band and
 * the live price, drawn as a "water" chart. All x-positions are derived from
 * real ticks (tickLower/tickUpper/bandTicks/currentTick) so the chart moves
 * with the chain, not a canned animation.
 */
export function Sounder({
  tick,
  tickLower,
  tickUpper,
  bandTicks,
  below,
  above,
  target,
}: {
  tick: number | undefined;
  tickLower: number;
  tickUpper: number;
  bandTicks: number;
  below: bigint;
  above: bigint;
  target: bigint;
}) {
  if (tick === undefined) {
    return (
      <div style={{ aspectRatio: "900/380", display: "grid", placeItems: "center", color: "#9AAAB8" }}>
        Waiting for price…
      </div>
    );
  }

  const bandLo = tick - bandTicks;
  const bandHi = tick + bandTicks;
  const lo = Math.min(tickLower, bandLo);
  const hi = Math.max(tickUpper, bandHi);
  const span = hi - lo || 1;
  const x = (t: number) => AXIS_L + ((t - lo) / span) * (AXIS_R - AXIS_L);

  const xp = x(tick);
  const bandL = x(bandLo);
  const bandR = x(bandHi);
  const inBand = tick >= tickLower - bandTicks && tick <= tickUpper + bandTicks;

  const belowPct = target > 0n ? Math.min(Number(below) / Number(target), 1) : 0;
  const abovePct = target > 0n ? Math.min(Number(above) / Number(target), 1) : 0;

  const priceLabel = tickToRel(tick, tickLower).toFixed(4);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Depth either side of the current price" style={{ width: "100%", height: "auto", display: "block", borderRadius: 20 }}>
      <defs>
        <linearGradient id="ll-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16245A" />
          <stop offset="0.6" stopColor="#0E2C45" />
          <stop offset="1" stopColor="#0A1A2A" />
        </linearGradient>
        <linearGradient id="ll-below" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#CEFFEA" stopOpacity={0.8} />
          <stop offset="1" stopColor="#2EAA8C" stopOpacity={0.18} />
        </linearGradient>
        <linearGradient id="ll-above" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DED6FF" stopOpacity={0.8} />
          <stop offset="1" stopColor="#6E5ADC" stopOpacity={0.18} />
        </linearGradient>
      </defs>

      <rect x={0} y={0} width={W} height={H} fill="url(#ll-water)" />

      {/* depth fill, scaled to how close each side is to target */}
      <rect x={AXIS_L} y={BOTTOM - (BOTTOM - TOP) * belowPct} width={Math.max(xp - AXIS_L, 0)} height={(BOTTOM - TOP) * belowPct} fill="url(#ll-below)" />
      <rect x={xp} y={BOTTOM - (BOTTOM - TOP) * abovePct} width={Math.max(AXIS_R - xp, 0)} height={(BOTTOM - TOP) * abovePct} fill="url(#ll-above)" />

      <line x1={AXIS_L} y1={BOTTOM} x2={AXIS_R} y2={BOTTOM} stroke="#FFFFFF" strokeWidth={1.5} strokeOpacity={0.85} />
      <line x1={AXIS_L} y1={TOP} x2={AXIS_R} y2={TOP} stroke="#CEFFEA" strokeWidth={1.25} strokeOpacity={0.8} />

      {/* band boundaries */}
      <line x1={bandL} y1={52} x2={bandL} y2={308} stroke="#FFFFFF" strokeWidth={1.25} strokeDasharray="6 6" strokeOpacity={0.85} />
      <line x1={bandR} y1={52} x2={bandR} y2={308} stroke="#FFFFFF" strokeWidth={1.25} strokeDasharray="6 6" strokeOpacity={0.85} />
      <text x={bandL} y={46} fill="#FFFFFF" fontSize={13} fontFamily="Inter, sans-serif" textAnchor="middle">
        band lo
      </text>
      <text x={bandR} y={46} fill="#FFFFFF" fontSize={13} fontFamily="Inter, sans-serif" textAnchor="middle">
        band hi
      </text>

      {/* position range */}
      <text x={x(tickLower)} y={90} fill="#CEFFEA" fontSize={12} fontFamily="Inter, sans-serif">
        range lo
      </text>
      <text x={x(tickUpper)} y={90} fill="#DED6FF" fontSize={12} fontFamily="Inter, sans-serif" textAnchor="end">
        range hi
      </text>

      {/* current price */}
      <circle cx={xp} cy={BOTTOM + 4} r={70} fill="none" stroke={inBand ? "#C6F36B" : "#FF9B9B"} className="ll-ping" strokeWidth={1.5} />
      <line
        x1={xp}
        y1={44}
        x2={xp}
        y2={BOTTOM}
        stroke={inBand ? "#C6F36B" : "#FF9B9B"}
        strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 6px ${inBand ? "rgba(198,243,107,1)" : "rgba(255,155,155,1)"})` }}
      />
      <text x={xp} y={352} fill="#FFFFFF" fontSize={14} fontWeight={600} fontFamily="Inter, sans-serif" textAnchor="middle">
        Price ≈ {priceLabel}
      </text>
    </svg>
  );
}
