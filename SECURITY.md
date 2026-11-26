# Security

Leadline holds a token issuer's inventory and a fixed retainer escrow inside a single
Uniswap v4 hook. There is no admin key, no owner, and no upgradability — if the hook is
wrong, there's no patch, so this document exists to make the review surface explicit
rather than implicit.

## Invariants

Each invariant below is enforced in `src/LeadlineHook.sol` and exercised by a test. I1 and
I10 replay real incidents through `HandoverRecall.t.sol`; I4 is fuzzed in
`SteerPingPoke.t.sol`; I2, I3, I5 and I7 are the "Notices to Mariners" attacks in
`test/attacks/RedTeam.t.sol`; I9 is exercised in `SteerPingPoke.t.sol`'s poke tests; I1,
I6, I8 and I10 are additionally checked by `test/invariant/Invariants.t.sol`'s
`LeadlineHandler` — random `swap`/`warp`/`steer`/`ping`/`poke`/`handover`/`settle`/`claim`/
`recall` sequences plus attacker actions (`attackerRecall`, `attackerSteer`,
`attackerUnlockCallback`, `attackerDonate`), checked after every call, 256 runs × 500 calls
with zero reverts expected (every handler action is wrapped in `try/catch` on purpose).

| # | Invariant | Enforced by | Test |
|---|---|---|---|
| I1 Custody | No function transfers charter inventory except `recall` (issuer-only); every other payout is pull-based via `owed`/`claim` | `recall`, `claim` | `HandoverRecall.t.sol::test_Recall_NeverPaysMarketMakerDirectly`; `Invariants.t.sol::invariant_NonIssuerBalanceOnlyGrowsViaClaim` |
| I2 Pool binding | Only `createCharter` takes a caller-supplied `PoolKey`; every other function takes a charter id, and `_afterSwap` no-ops for any pool with `charterOf[poolId] == 0` | `charterOf` mapping, `_afterSwap` early return | `RedTeam.t.sol::test_I2_SwapsInUnchartedPoolDoNotTouchCharterState` |
| I3 Caller auth | `afterSwap`/`beforeDonate` are `onlyPoolManager` (OZ `BaseHook`); `unlockCallback` checks `msg.sender == poolManager`, and `PoolManager.unlock` only ever calls back its own caller, so nothing but the hook's own `_modify` can reach it with chosen data | `onlyPoolManager`, `unlockCallback`'s sender check | `RedTeam.t.sol::test_I3_DirectUnlockCallbackReverts`, `test_I3_DirectAfterSwapReverts` |
| I4 Bounded steering | `steer`/`createCharter` require the range to contain the current tick, be aligned to `tickSpacing`, and fall inside `[minWidth, maxWidth] ⊂` the global caps | `CharterLib.validateParams`/`validateSteer` | `SteerPingPoke.t.sol::testFuzz_Steer_AlwaysBoundedAndContainsPrice` |
| I5 No swap path | The hook only ever calls `PoolManager.modifyLiquidity`; it never calls `PoolManager.swap` or any router | absence of a swap call | `RedTeam.t.sol::test_I5_HookSourceNeverCallsPoolManagerSwap` |
| I6 Conservation | Every outflow is rounded down against tracked balances (`idle`, `fees`, `owed`, `retainerRemaining`) | rounding direction in `_removeLiquidity`/`_addLiquidity`/`_closeEpoch` | `EpochAccrualClaim.t.sol::test_MultipleEpochs_PayoutsAndRefundsNeverExceedTotalRetainer`; `Invariants.t.sol::invariant_HookBalanceCoversTrackedLiabilities` over 128k random calls |
| I7 Honest measurement | Depth is recomputed from the pool's own price and the charter's own liquidity after every swap; `beforeDonate` always reverts | `DepthMath`, `_recache`, `_beforeDonate` | `RedTeam.t.sol::test_I7_WashTradeMovesFeesNotDepth` |
| I8 Bounded pay | `payout = budget × scoreBps / 10000` with `scoreBps ≤ 10000` and `budget ≤ retainerRemaining`; `epochIndex` only increases | `_closeEpoch` | `EpochAccrualClaim.t.sol::test_FullyInBandEpoch_ScoresMaxAndPaysFullBudget`, `test_MultipleEpochs_...`; `Invariants.t.sol::invariant_RetainerNeverExceedsDeposit` |
| I9 Liveness | `poke` is callable by anyone once `now > lastHeartbeat + graceSeconds`, and only widens the range to the fallback band | `poke` | `SteerPingPoke.t.sol::test_Poke_AnyoneCanMoveStaleCharterToFallback`, `test_Poke_RevertWhenHeartbeatFresh` |
| I10 Unblockable recall | `recall` is pull-based for every other party, makes no external call to the market maker, and cannot be paused | `recall` | `HandoverRecall.t.sol::test_Recall_SucceedsEvenIfMarketMakerContractReverts`; `Invariants.t.sol::invariant_RecallNeverFailsWhileActive` |

## Hardening checklist

- [x] No admin key, no owner, no upgradability (no `Ownable`, no proxy pattern anywhere in `src/`).
- [x] No `tx.origin`, no `delegatecall` anywhere in `src/`.
- [x] Checks-effects-interactions: every state-changing function validates and updates `charters[id]`/`owed` before or alongside the single `unlock`/`claim` external call it makes; `claim` zeroes `owed` before transferring (`src/LeadlineHook.sol`, `claim`).
- [x] Mined hook address carries exactly the two permission bits `getHookPermissions()` declares — `afterSwap` and `beforeDonate` — confirmed by `HookMiner.find` + the `require(address(hook) == hookAddress)` check in both `LeadlineFixture.setUp` and `DeployLocal.s.sol`; a mismatch there reverts deployment outright, so there is no path to a live deployment with extra permission bits.
- [x] Donations blocked (`_beforeDonate` always reverts `DonationsDisabled`).
- [x] `unlockCallback` only proceeds for `msg.sender == poolManager`; see I3.
- [x] [Trail of Bits' "Building secure Uniswap v4 hooks"](https://github.com/Trail-of-Bits/publications) checklist walked through: caller checks (OZ `BaseHook`'s `onlyPoolManager`, this project's whole reason for building on it instead of raw `BaseHook` from v4-periphery — see §5.1), no unbounded loops (`_accrue` is capped at `CharterLib.MAX_EPOCHS_PER_ACCRUE` per call; `settle` is idempotent and can be called again to continue), no reliance on `tx.origin`, liquidity callbacks guarded against a second entry via the `msg.sender == poolManager` check (PoolManager's own `unlock` lock prevents a nested `unlock` from succeeding), and no hook-level swap fee manipulation (`getHookPermissions` doesn't set `beforeSwap`/`afterSwapReturnDelta`, so the hook can't alter quotes or outcomes — see §5.1's "boring to route through" design goal).

## Slither

Run with `slither src/LeadlineHook.sol --foundry-out-directory out` (install via `pip install slither-analyzer`).
Scoped to `src/LeadlineHook.sol` and `src/libraries/*`; everything else in the 150 raw
findings is Slither walking the whole v4-core/v4-periphery/OpenZeppelin dependency tree
(pragma mismatches, dead code in library types we don't call, cyclomatic complexity in
`TickMath`) and isn't this project's to fix.

| Finding | Where | Resolution |
|---|---|---|
| `unimplemented-functions`: `LeadlineHook` doesn't implement `BaseHook.getHookPermissions()` | whole contract | **False positive.** `getHookPermissions()` is implemented at `src/LeadlineHook.sol:60`; `HookMiner.find` and the deploy-time address-match `require` would fail deployment if it weren't. Confirmed and left as-is. |
| `shadowing-local`: local `currentTick` shadows the `currentTick(uint256)` view | `createCharter`, `steer`, `poke` | **Fixed.** Locals renamed to `tickNow` (`fix(hook): rename shadowed currentTick locals to tickNow`). |
| `incorrect-equality`: strict `==` in `_accrue` (`segEnd == epochEnd`) and `projectedScore` (`duration == 0`, `uptimeTarget == 0`) | `_accrue`, `projectedScore` | **Reviewed, no change.** These aren't attacker-influenced floating-point or balance comparisons; `segEnd`/`epochEnd` are both derived from the same monotonic `block.timestamp` arithmetic and are exactly equal whenever a segment reaches an epoch boundary, which is the condition being tested for. The zero-checks are plain divide-by-zero guards. |
| `timestamp`: several functions compare against `block.timestamp` | `_afterSwap`, `createCharter`, `poke`, `_accrue`, `projectedScore` | **Reviewed, no change.** Every comparison is against epoch/grace/term windows measured in tens of seconds to days; none of them gate a fund-moving decision on sub-second miner timestamp manipulation, which is the actual risk this detector flags. |
| `reentrancy-no-eth` / `reentrancy-benign` / `reentrancy-events`: external calls (`poolManager.modifyLiquidity`, `currency.take`/`settle`, `poolManager.unlock`) followed by state writes or event emissions | `_addLiquidity`, `_removeLiquidity`, `createCharter`, `steer`, `poke`, `recall` | **Reviewed, no change.** This is the standard v4 "hook owns a position via `unlock`" pattern (§5.6): every external call in this group targets `poolManager` itself, which is immutable and set once in the constructor — never an attacker-influenced address. `PoolManager.unlock` holds its own transient lock for the duration of the callback, so there is no path for a second `unlock` (and so no second `unlockCallback`) to interleave. The charter's own state is only ever written inside the single `unlockCallback` that `_modify` triggered, by the same transaction. |
| `incorrect-modifier`: `Hooks.noSelfCall` doesn't always execute `_;` or revert | v4-core's `Hooks.sol` | **Not this project's code** — upstream v4-core library, out of scope. |

No findings required a behavior change beyond the one shadowing fix.

## Known limitations

See BUILD.md §16 for the full list (price is measured at the current tick rather than a
TWAP; a market maker can still trade against the issuer's liquidity from a separate
wallet; one charter per pool). On top of those:

- **`forge coverage` doesn't run with this project's `via_ir = true` build** (`Stack too
  deep` even with `--ir-minimum`). A coverage number for the README needs either a
  coverage-only profile with `via_ir = false` and a lower optimizer runs count, or a
  Foundry version where this is fixed — not yet resolved here.
