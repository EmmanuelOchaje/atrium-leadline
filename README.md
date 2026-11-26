# Leadline

**Let the pool prove the depth.**

Leadline is a Uniswap v4 hook that turns a token issuer's market-making agreement into a
mandate the pool enforces. The market maker can steer the issuer's liquidity but never take
it; the hook measures the depth actually delivered ("Proof of Depth") and the market maker
is paid only for the share of the target met.

Built for the Uniswap Hook Incubator, cohort 11. See [BUILD.md](./BUILD.md) for the full
specification and day-by-day build plan this repo follows, and [SECURITY.md](./SECURITY.md)
for the invariant-by-invariant security review.

## The problem

Issuers pay market makers for depth, uptime and a tight spread but can't verify any of it,
and the market maker usually holds the inventory. Fewer than 1% of 150+ protocols disclose
market-maker terms (Novora, Apr 2026). On v4, launchpads graduate thousands of tokens into
pools nobody manages.

## How it works

1. **Charter.** The issuer writes a mandate: depth band (e.g. ±2%), target depth per side,
   uptime target, epoch length, grace period, retainer per epoch, term, market maker,
   understudy.
2. **Custody.** The issuer deposits inventory and escrows the whole retainer. The hook holds
   the position (`owner = hook`, `salt = charterId`) — the issuer can never be locked out.
3. **Steering.** The market maker steers the range (must contain the current price, width
   within bounds, swap-free). Every steer or ping is a heartbeat.
4. **Measurement.** On every swap, the hook accrues Proof of Depth: depth × time below and
   above the price inside the band, plus seconds spent with both sides at target.
5. **Settlement.** Each epoch closes: `payout = retainer × duration share × score`. The
   market maker claims it; the rest refunds to the issuer. Swap fees always belong to the
   issuer.
6. **Liveness.** A stale heartbeat lets anyone `poke` the position into a wide fallback
   range; the issuer can `handover` to the Understudy in one transaction.
7. **Recall.** The issuer can recall everything at any time — pull-based, no call to the
   market maker, nothing can block it.
8. **League.** Every closed epoch becomes a public scorecard row in the Proving Ground.

## Why it has to be a hook

- It scores every swap as it happens — there's no "report" to trust or dispute.
- It owns the position directly, so the custody guarantee is structural, not contractual.
- It blocks donations (`beforeDonate` always reverts), closing the cheapest way to pad a
  depth figure without actually providing any.

## Architecture

```
leadline/
├─ BUILD.md, SECURITY.md         # spec and security review
├─ contracts/                    # Foundry project
│  ├─ src/LeadlineHook.sol       # the hook: charters, steering, accrual, liveness, payouts
│  ├─ src/libraries/             # DepthMath (pure, fuzzed), CharterLib (param validation)
│  ├─ src/interfaces/ILeadline.sol
│  ├─ test/unit, test/attacks, test/invariant
│  └─ script/DeployLocal.s.sol, SeedLeague.s.sol
├─ packages/sdk/                 # shared TypeScript: ABIs, DepthMath mirror, strategy, flows
├─ apps/web/                     # Next.js console, league, replay, red-team panel
└─ bots/                         # CLI market maker, swap flow, scripted attacks
```

## Security invariants

Ten invariants, each replaying a real incident or closing a specific attack path. Full
detail, enforcing code, and every test that exercises it — including an invariant-fuzz
campaign over random action sequences — is in [SECURITY.md](./SECURITY.md); summary:

| # | Invariant | Incident it answers |
|---|---|---|
| I1 Custody | Movement (2025); Visor, Concentric key compromises |
| I2 Pool binding | Safe/rsETH module (Sept 2026, ~$7.7M) |
| I3 Caller auth | Cork (May 2025, ~$11–12M) |
| I4 Bounded steering | Gamma (Jan 2024) |
| I5 No swap path | DRLVaultV3 (Nov 2025) |
| I6 Conservation | Bunni v2 (Sept 2025, ~$8.4M) |
| I7 Honest measurement | Score padding / wash trading |
| I8 Bounded pay | Popsicle (Aug 2021, ~$20M) |
| I9 Liveness | Keepers going dark |
| I10 Unblockable recall | Arcadia (Jul 2025, ~$3.6M) |

**Notices to Mariners** (`/charters/[id]/notices` in the web app) runs 9 of these 11 attacks
as real transactions against the running chain and reports what actually happened, not a
hardcoded expectation. The CLI twin, `bots/attacks.ts`, covers all of them, including the
one the web page can't run live (deploying a second pool with no charter on it).

## Run it locally

Prerequisites: Node 18+, [Foundry](https://getfoundry.sh), pnpm.

```bash
pnpm install
cd contracts && forge build

# Terminal 1
anvil --block-time 1

# Terminal 2 — deploys PoolManager, routers, tokens, the mined hook, and charter #1
cd contracts
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast

# optional: seed the Proving Ground with 3 more charters and history
forge script script/SeedLeague.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --slow -g 400

# Terminal 3
pnpm -C packages/sdk build
pnpm web:dev
# open http://localhost:3000
```

The web app defaults to demo mode on chain 31337: a role switcher in the header swaps
between Issuer / Market maker / Understudy / Swapper / Anyone, using anvil's well-known
accounts, with no wallet pop-ups. Press **D** for the demo drawer (swap flows, the
market-maker autopilot — the "kill the bot" switch — and fast-forward to an epoch
boundary).

CLI bots, for the same local chain or a testnet:

```bash
pnpm bots:mm --charter 1 --interval 3 --die-after 90
pnpm bots:flow --mode calm --seed 7 --rate 2   # mode: calm|volatile|pump|dump|wash
pnpm bots:attacks --attack custody              # or steer-far|donate|wash|callback|pool-key|double-settle
```

## Tests

```bash
cd contracts && forge fmt && forge test
```

47 tests: unit tests per function, a fuzzed property suite for `DepthMath`, the red-team
suite in `test/attacks/RedTeam.t.sol`, and an invariant campaign
(`test/invariant/Invariants.t.sol`) running 256 runs × 500 random
swap/warp/steer/ping/poke/handover/settle/claim/recall/attacker-action calls — 128,000
calls, 0 reverts expected, checked against I1/I6/I8/I10 after every one.

**Coverage:** `forge coverage` doesn't currently run under this project's `via_ir = true`
build (`Stack too deep`, even with `--ir-minimum`); a real percentage for this README needs
either a coverage-only profile or a Foundry fix. Not resolved yet — see SECURITY.md's Known
limitations.

## What's built vs. what isn't

This README describes the actual state of the repo, not the target state in BUILD.md.

**Built:** the full core loop (create/steer/ping/poke/handover/settle/claim/recall),
liveness and fallback, the invariant-fuzz handler, the red-team suite, the web Console with
a live Sounder chart, demo mode (role switcher, drawer, autopilot), live Notices to
Mariners, Proving Ground (reads real `EpochClosed`/`HandedOver` events; `SeedLeague.s.sol`
gives it history), Replay (re-scores closed epochs with a different band from the charter's
own event history), the charter composer, and all three CLI bots.

**Not built:** a testnet deployment (needs a funded Unichain Sepolia key this environment
doesn't have), the real-pool depth-analysis script (`analysis/launchpad-depth.ts` — needs
archive-RPC access), a demo video, outreach replies, and the coverage number above. None of
these are faked in this README; they're just not here yet.

## Known limitations

See [BUILD.md §16](./BUILD.md) for the full list and the stretch backlog. The short version:
a market maker can still trade against the issuer's liquidity from a separate wallet; depth
is measured at the current pool price rather than a TWAP, so a brief price push can inflate
it (at the cost of fees and arbitrage risk); and it's one charter per pool with one position
per charter, so leftover inventory between steers sits idle.

## License

MIT

---

*Built for the [Uniswap Hook Incubator](https://www.uniswapfoundation.org/), cohort 11.*
