function seededRandom(seed: number) {
  let x = seed;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

/** A scattered field of twinkling dots — cheap atmosphere for the dark hero sections. */
export function Starfield({ seed = 11, count = 50, heightPct = 62 }: { seed?: number; count?: number; heightPct?: number }) {
  const rnd = seededRandom(seed);
  const stars = Array.from({ length: count }, () => {
    const s = 1 + Math.round(rnd() * 2);
    return {
      left: (rnd() * 100).toFixed(2),
      top: (rnd() * heightPct).toFixed(2),
      size: s,
      delay: (rnd() * 4).toFixed(2),
    };
  });

  return (
    <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {stars.map((s, i) => (
        <span
          key={i}
          className="ll-twinkle"
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#FFFFFF",
            opacity: 0.6,
            animationDelay: `-${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
