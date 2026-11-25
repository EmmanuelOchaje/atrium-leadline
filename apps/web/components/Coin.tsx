function hashHue(address: string): number {
  let h = 0;
  for (let i = 0; i < address.length; i++) {
    h = (h * 31 + address.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

/** A small deterministic "coin" avatar, colored from the address itself. */
export function Coin({ address, size = 36 }: { address: string; size?: number }) {
  const hue = hashHue(address.toLowerCase());
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-block",
        background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.6), transparent 45%), conic-gradient(from ${hue}deg, hsl(${hue},55%,35%), hsl(${(hue + 60) % 360},70%,78%), hsl(${(hue + 20) % 360},55%,45%))`,
        boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.15)",
      }}
    />
  );
}
