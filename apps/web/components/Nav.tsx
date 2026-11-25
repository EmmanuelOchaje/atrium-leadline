"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/charters/1", label: "Live charter" },
  { href: "/league", label: "Proving Ground" },
  { href: "/security", label: "Security" },
  { href: "/charters/new", label: "Write a charter" },
];

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function Nav() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <header
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        padding: "6px 16px 20px",
      }}
    >
      <Link
        href="/"
        aria-label="Leadline home"
        style={{ display: "flex", alignItems: "center", gap: 10, color: "#FFFFFF" }}
      >
        <Logo size={36} />
        <span style={{ fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontWeight: 700, fontSize: 23, letterSpacing: "-0.03em" }}>
          leadline
        </span>
      </Link>

      <nav
        aria-label="Main"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 4,
          padding: 6,
          borderRadius: 999,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        {LINKS.map((l) => {
          const active = pathname === l.href || (l.href === "/charters/1" && pathname?.startsWith("/charters/") && pathname !== "/charters/new");
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                padding: "9px 16px",
                borderRadius: 999,
                fontSize: 14,
                color: active ? "#0B0926" : "#EEF4F1",
                background: active ? "#FFFFFF" : "transparent",
                fontWeight: active ? 600 : 400,
              }}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>

      {isConnected && address ? (
        <button
          onClick={() => disconnect()}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 42,
            padding: "0 16px",
            borderRadius: 999,
            background: "rgba(198,243,107,0.1)",
            border: "1px solid rgba(198,243,107,0.35)",
            color: "#DDF7A8",
            fontSize: 14,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#C6F36B", boxShadow: "0 0 10px #C6F36B" }} />
          {shortAddr(address)}
        </button>
      ) : (
        <button
          onClick={() => connectors[0] && connect({ connector: connectors[0] })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 42,
            padding: "0 18px",
            borderRadius: 999,
            background: "#FFFFFF",
            color: "#0B0926",
            fontSize: 14,
            fontWeight: 600,
            border: 0,
          }}
        >
          Connect wallet
        </button>
      )}
    </header>
  );
}
