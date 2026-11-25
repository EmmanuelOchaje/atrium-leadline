export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.7), transparent 45%), conic-gradient(from 200deg, #2E8B6A, #B7F5D8, #1F5E4C, #8FF0C4, #2E8B6A)",
        boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.18)",
        flexShrink: 0,
      }}
    >
      <svg width={size * 0.42} height={size * 0.47} viewBox="0 0 16 18" fill="#FFFFFF">
        <rect x="7" y="0" width="2" height="10" />
        <path d="M4 10h8l2 7H2z" />
      </svg>
    </span>
  );
}
