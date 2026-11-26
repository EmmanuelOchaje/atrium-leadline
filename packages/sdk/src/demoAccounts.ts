import { privateKeyToAccount } from "viem/accounts";

/** Solidity hex literals drop leading zero nibbles; pad back to a full 32-byte key for viem. */
function pad32(hex: string): `0x${string}` {
  return `0x${hex.slice(2).padStart(64, "0")}`;
}

/**
 * Anvil's well-known default accounts, matching the private keys
 * `DeployLocal.s.sol` falls back to when no env override is set (§8), plus
 * account #4 for "Anyone" — an address with no role in the charter, used for
 * permissionless actions (poke, settle, claim). Shared by the web Console's
 * demo role switcher and the CLI bots, so both act as the same identities.
 */
const DEMO_KEYS = {
  issuer: pad32("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"),
  marketMaker: pad32("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690"),
  understudy: pad32("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365"),
  swapper: pad32("0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007"),
  anyone: pad32("0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926"),
} as const;

export type DemoRole = keyof typeof DEMO_KEYS;

const ROLE_LABELS: Record<DemoRole, string> = {
  issuer: "Issuer",
  marketMaker: "Market maker",
  understudy: "Understudy",
  swapper: "Swapper",
  anyone: "Anyone",
};

export const DEMO_ROLES: { role: DemoRole; label: string; address: `0x${string}`; privateKey: `0x${string}` }[] =
  (Object.keys(DEMO_KEYS) as DemoRole[]).map((role) => {
    const privateKey = DEMO_KEYS[role] as `0x${string}`;
    return { role, label: ROLE_LABELS[role], address: privateKeyToAccount(privateKey).address, privateKey };
  });

export function demoPrivateKey(role: DemoRole): `0x${string}` {
  return DEMO_KEYS[role] as `0x${string}`;
}
