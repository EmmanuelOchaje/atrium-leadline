# Leadline — BUILD.md

> **Leadline** is a Uniswap v4 hook that turns a token issuer's market-making agreement into a
> mandate the pool enforces. The market maker can steer the issuer's liquidity but never take it;
> the hook measures the depth actually delivered ("Proof of Depth") and the market maker is paid
> only for the share of the target met. If the market maker goes dark, anyone can make the
> position safe and the issuer hands it to a backup (the "Understudy") in one transaction.

UHI11 Hookathon · theme: Active Management & Curated Liquidity · solo build
Final submission: **Thu 3 Dec 2026, 11:59pm PST** (= Fri 4 Dec, 08:59 Lagos). Treat **Wed 2 Dec** as the real deadline.

---

## 0. How to use this file

- Save this file as `BUILD.md` at the repo root. Create `CLAUDE.md` with one line: `Read BUILD.md before doing anything. Follow its rules, layer order and invariants.`
- Every Claude Code session starts from this file. When a decision changes, **edit this file first**, then the code.
- Work in the **layer order** (§13). Never start a layer until the previous layer's gate is green.
- Rules for every coding session:
  1. Tests before code for anything that touches funds. Write the failing test, then the code.
  2. Small diffs. One concern per commit. Read every diff before committing.
  3. Never hand-roll pool maths. Use v4-core / v4-periphery libraries (§5.4).
  4. Before using any library function, open its source in `lib/` and confirm the exact signature in the installed version. v4 APIs have moved between releases; do not trust memory.
  5. `forge fmt && forge test` green before every commit. Frontend: `pnpm lint && pnpm typecheck`.
  6. No admin keys, no owner, no upgradability. This is a selling point; keep it true.

### Honest commit cadence (read this)

The schedule in §13 spreads commits across the window because **the work is spread across the window**. Commit each piece when it's done and push at least once a day. Never backdate commits or rewrite timestamps (`GIT_COMMITTER_DATE`, `--date`, rebasing history to fake a timeline): organisers can check push times against GitHub's server-side timestamps, and a faked history is far worse than an uneven one. A real, steady history is what proves the project was built during the hookathon.

---

## 1. The product on one page

**Problem.** Issuers pay market makers for depth, uptime and a tight spread but can't verify any of it, and the market maker usually holds the inventory. Fewer than 1% of 150+ protocols disclose market-maker terms (Novora, Apr 2026). Movement (2025) shows what happens when it goes wrong. On v4, launchpads graduate thousands of tokens into pools nobody manages.

**Who it's for.** Issuers whose main market is a v4 pool: launchpad graduates, small stablecoins, tokenized assets.

**The mechanism.**
1. Issuer writes a **charter**: depth band (e.g. ±2%), target depth per side, uptime target, epoch length, grace period, retainer per epoch, term, market maker, Understudy.
2. Issuer deposits inventory + escrows the whole retainer. The hook holds the liquidity position (owner = hook, `salt = charterId`).
3. Market maker **steers** the range (must contain the current price, width within bounds, swap-free). Every steer or ping is a heartbeat.
4. On every swap the hook accrues **depth × time** below and above the price inside the band, plus **seconds in band** (both sides ≥ target).
5. Each epoch closes: `payout = retainer × duration share × score`. Market maker claims it; the rest is refunded to the issuer. Swap fees always belong to the issuer.
6. Heartbeat stale past grace → **anyone** can `poke` the position into a wide fallback range. Issuer `handover`s to the Understudy in one transaction.
7. Issuer can `recall` everything at any time; nothing can block it.
8. Every closed epoch becomes a public scorecard row → the **Proving Ground** league.

**Names used everywhere (UI + code + pitch):**

| Name | Meaning |
|---|---|
| Leadline | Protocol and hook |
| Charter | The mandate an issuer writes |
| Proof of Depth | The score: depth inside the band × time |
| Proving Ground | League of market makers ranked by delivered depth |
| Understudy | Backup market maker |

**Positioning line.** Arrakis proved issuers want to keep custody. Coinwatch and Forgd proved issuers will pay to verify their market maker. Vega proved pay-on-delivery works onchain. Leadline puts all three inside the pool, open to any market maker. *Others watch market makers. Leadline holds the keys.*

**Two-sided by design.** The issuer can't dodge payment (retainer escrowed upfront, payout is a formula), and the market maker can't dump or vanish with inventory. This is why a good market maker would sign.

---

## 2. Scope by layer (what "done" means)

| Layer | Target date | Contains | Gate to pass |
|---|---|---|---|
| L1 Core loop | Mon 23 Nov | create, steer, afterSwap accrual, epoch close, claim, recall; I1 I4 I6 I8; one Console page; scripted bots | End-to-end on anvil: create → steer → swaps → epoch closes → MM claims partial pay → recall returns the rest |
| L2 Liveness | Thu 26 Nov | ping, poke → fallback, handover to Understudy, I9; Sounder + Score panel + Charter composer; demo mode | "Kill the bot" scenario works live, twice in a row |
| L3 Hardening | Sat 28 Nov | I2 I3 I5 I7 I10, donations blocked, Slither clean, Red-team panel ("Notices to Mariners") | Every red-team attack reverts with the named invariant or provably changes nothing |
| L4 League | Mon 30 Nov | Proving Ground + market-maker profile, Replay with re-scoring, landing page | League renders from real events; replay re-scores with a different band |
| L5 Evidence | Tue 1 Dec | Real-pool depth analysis, testnet deploy + verify, README, buyer quote | Testnet addresses verified; one chart from real pools; README complete |
| Polish | Wed 2 Dec | Stage mode, video, rehearsals, feature freeze | 3 clean rehearsals; backup video recorded |

If a layer slips, cut from the *next* layer, never from the current gate. After L1 you have a submittable project; after L2 a competitive one; after L3 a strong one.

**Out of scope unless ahead of schedule:** TWAP reference price, bonds/slashing, net-sell caps, Reactive Network automation, launchpad integration, multiple charters per pool, an external indexer (Ponder).

---

## 3. Repository layout

```
leadline/
├─ BUILD.md                      # this file
├─ CLAUDE.md                     # "Read BUILD.md first"
├─ README.md                     # judge-facing (§15)
├─ package.json                  # pnpm workspace root
├─ pnpm-workspace.yaml
├─ contracts/                    # Foundry project (from uniswapfoundation/v4-template)
│  ├─ foundry.toml
│  ├─ src/
│  │  ├─ LeadlineHook.sol
│  │  ├─ libraries/DepthMath.sol
│  │  ├─ libraries/CharterLib.sol     # param validation, epoch maths
│  │  └─ interfaces/ILeadline.sol     # structs, events, errors
│  ├─ test/
│  │  ├─ unit/        DepthMath.t.sol, Create.t.sol, Steer.t.sol, Accrual.t.sol,
│  │  │               Epoch.t.sol, Liveness.t.sol, Recall.t.sol, Claim.t.sol
│  │  ├─ invariant/   LeadlineHandler.sol, Invariants.t.sol
│  │  ├─ attacks/     RedTeam.t.sol      # one test per red-team card
│  │  └─ utils/       LeadlineFixture.sol
│  └─ script/
│     ├─ DeployLocal.s.sol    # anvil: PoolManager, routers, tokens, hook, pool, charter
│     ├─ DeployTestnet.s.sol  # Unichain Sepolia
│     └─ SeedLeague.s.sol     # demo history for the league
├─ packages/
│  └─ sdk/                     # shared TS: ABIs, addresses, DepthMath mirror, strategies
│     ├─ src/abi.ts            # generated by @wagmi/cli (foundry plugin)
│     ├─ src/addresses.ts      # per-chain deployments (written by deploy scripts)
│     ├─ src/depth.ts          # TS mirror of DepthMath (for replay + tests)
│     ├─ src/ticks.ts          # % ↔ ticks, tick alignment, price formatting
│     ├─ src/strategy.ts       # market-maker strategy shared by CLI bot + web autopilot
│     └─ src/flows.ts          # seeded swap-flow generators (calm, volatile, pump, wash)
├─ bots/
│  ├─ mm.ts                    # market-maker bot (CLI)
│  ├─ flow.ts                  # swap-flow bot (CLI)
│  └─ attacks.ts               # scripted red-team attacks (CLI)
├─ analysis/
│  └─ launchpad-depth.ts       # real-pool evidence script (§12)
└─ apps/
   └─ web/                     # Next.js app (§11)
```

---

## 4. Stack

Pin to the latest stable versions at the time you install (Day 0) and record them in `package.json` / `foundry.toml`. Don't upgrade mid-hookathon.

| Area | Choice | Why |
|---|---|---|
| Contracts | Solidity (version from v4-template), Foundry | Template is set up for v4 |
| Hook base | OpenZeppelin `uniswap-hooks` `BaseHook` | Caller checks (`onlyPoolManager`) built in; the Cork exploit was a missing one |
| Pool maths | v4-core `TickMath`, `SqrtPriceMath`, `FullMath`, `StateLibrary`; v4-periphery `LiquidityAmounts`; OZ `CurrencySettler` | Never hand-roll |
| Address mining | v4-periphery `HookMiner` | Permission bits live in the address |
| Static analysis | Slither | Free, catches the obvious |
| Monorepo | pnpm workspaces | Shared SDK for bots + web |
| Web | Next.js (App Router), TypeScript, Tailwind CSS v4 | Fast, familiar |
| Chain access | viem, wagmi, TanStack Query; RainbowKit for testnet wallets | Typed, reliable |
| ABIs | `@wagmi/cli` with the Foundry plugin | Typed ABIs regenerated on every build |
| Charts | d3-scale, d3-shape, hand-written SVG | The Sounder is custom; chart libraries would fight it |
| Motion | `motion` (Framer Motion) | One orchestrated moment (§11.2) |
| Numbers | `@number-flow/react` | Smooth tabular number changes |
| State | zustand (demo/stage state only) | Small |
| Testnet | Unichain Sepolia (fallback: Base Sepolia) | v4 deployed; get PoolManager, PositionManager, StateView addresses from docs.uniswap.org/contracts/v4/deployments — never from memory |

---

## 5. Contracts

### 5.1 Hook overview

`LeadlineHook` inherits OZ `BaseHook` and implements `IUnlockCallback`.

**Permissions (mine the address for exactly these):**

| Flag | Used for |
|---|---|
| `afterSwap` | Accrue Proof of Depth after every swap; emit `DepthUpdated` |
| `beforeDonate` | Revert. Donations would pad fee figures and are never needed |

Everything else `false`. No `afterSwapReturnDelta` — the hook never changes swap outcomes, which keeps routers and aggregators happy (malicious hooks that alter quotes are a known problem; Leadline must be boring to route through).

**Why the hook owns positions.** Positions are keyed `(owner, tickLower, tickUpper, salt)` with `owner = msg.sender` of `modifyLiquidity`. The hook is the caller, so only the hook can ever change a charter's position. `salt = bytes32(charterId)`. When the hook itself modifies liquidity, PoolManager skips the hook's own liquidity callbacks (`noSelfCall`), so there's no re-entry.

**One charter per pool** (MVP). `charterOf[poolId]` → id. Swaps in pools without a charter return immediately.

### 5.2 Data model

```solidity
// interfaces/ILeadline.sol
enum Status { None, Active, Fallback, Recalled }

struct CharterParams {
    PoolKey  key;               // pool must use this hook; checked
    address  marketMaker;
    address  understudy;        // may be zero; set later with setUnderstudy
    bool     quoteIsCurrency1;  // which side is the quote (e.g. USDC)
    uint256  amount0;           // inventory deposited
    uint256  amount1;
    int24    tickLower;         // initial range (must contain current tick)
    int24    tickUpper;
    int24    bandTicks;         // half-width of the depth band in ticks (±2% ≈ 198 → round to spacing)
    int24    minWidth;          // range width bounds in ticks, inside global caps
    int24    maxWidth;
    int24    fallbackHalfWidth; // wide passive range used by poke (e.g. ±20% ≈ 1823)
    uint256  targetDepth;       // per side, in quote token raw units
    uint16   uptimeBps;         // e.g. 9000 = 90%
    uint32   epochLength;       // seconds (demo: 120)
    uint32   graceSeconds;      // heartbeat staleness allowed (demo: 45)
    uint32   numEpochs;         // term length in epochs
    address  retainerToken;     // ERC20 (demo: mock USDC)
    uint256  retainerPerEpoch;
}

struct Charter {
    PoolKey  key;
    address  issuer;
    address  marketMaker;
    address  understudy;
    Status   status;
    bool     quoteIsCurrency1;
    // position
    int24    tickLower;
    int24    tickUpper;
    uint128  liquidity;
    // balances held by the hook for this charter (raw token units)
    uint256  idle0;
    uint256  idle1;
    uint256  fees0;             // swap fees, always owed to the issuer
    uint256  fees1;
    // terms
    int24    bandTicks;
    int24    minWidth;
    int24    maxWidth;
    int24    fallbackHalfWidth;
    uint256  targetDepth;
    uint16   uptimeBps;
    uint32   epochLength;
    uint32   graceSeconds;
    address  retainerToken;
    uint256  retainerPerEpoch;
    uint256  retainerRemaining; // escrow not yet allocated to closed epochs
    uint64   termEnd;
    // liveness
    uint64   lastHeartbeat;
    // current epoch accumulators
    uint32   epochIndex;
    uint64   epochStart;
    uint64   lastAccrual;
    uint256  belowDepthSeconds; // Σ depthBelow × dt (quote units × seconds)
    uint256  aboveDepthSeconds;
    uint64   secondsInBand;     // Σ dt where both sides ≥ target
    uint256  cachedBelow;       // depth at last update (quote units)
    uint256  cachedAbove;
}

struct EpochResult {
    uint64  start;
    uint64  end;
    address marketMaker;
    uint256 belowDepthSeconds;
    uint256 aboveDepthSeconds;
    uint64  secondsInBand;
    uint16  scoreBps;           // 0..10000
    uint256 payout;             // to market maker
    uint256 refund;             // back to issuer
}

mapping(uint256 => Charter) charters;
mapping(PoolId => uint256)  charterOf;           // 0 = none (ids start at 1)
mapping(uint256 => mapping(uint32 => EpochResult)) epochs;
mapping(address => mapping(address => uint256)) owed;  // account => token => claimable
```

### 5.3 Functions

All state-changing functions take a **charter id**, never a `PoolKey` (I2). The stored `key` is the only key ever used.

| Function | Caller | Preconditions | Effects |
|---|---|---|---|
| `createCharter(CharterParams p) returns (uint256 id)` | anyone (becomes issuer) | `p.key.hooks == this`; pool initialized; `charterOf[poolId] == 0`; all params inside global caps (§5.8); range aligned to `tickSpacing`, contains current tick, width within `[minWidth, maxWidth]` | Pull `amount0`, `amount1`, `retainerPerEpoch × numEpochs`; add liquidity via unlock; leftover → idle; start epoch 0; `lastHeartbeat = now`; `status = Active`; cache depth; emit `CharterCreated` |
| `steer(id, tickLower, tickUpper)` | market maker | status Active or Fallback; aligned; contains current tick; width within bounds | `_accrue`; remove all liquidity + collect fees (fees → `fees0/1`); add max liquidity for new range from idle balances; leftover stays idle; `status = Active`; heartbeat; recache; emit `Steered` |
| `ping(id)` | market maker | status Active | heartbeat; emit `Pinged` |
| `poke(id)` | anyone | status Active; `now > lastHeartbeat + graceSeconds` | `_accrue`; move position to `[tick − fallbackHalfWidth, tick + fallbackHalfWidth]` (aligned, clamped to Min/Max tick); `status = Fallback`; recache; emit `Poked` |
| `setUnderstudy(id, addr)` | issuer | status ≠ Recalled; `addr ≠ marketMaker` | set; emit `UnderstudySet` |
| `handover(id)` | issuer | understudy ≠ 0 | `_accrue`; close current epoch at `now` (outgoing MM gets its pro-rated pay); `marketMaker = understudy`; `understudy = 0`; heartbeat; emit `HandedOver` |
| `settle(id, maxEpochs)` | anyone | — | `_accrue`, which closes every fully elapsed epoch up to `maxEpochs`; idempotent |
| `recall(id)` | issuer | status ≠ Recalled | `_accrue`; close current epoch at `now`; remove all liquidity + fees; transfer principal + idle + fees to issuer; credit unspent `retainerRemaining` to issuer's `owed`; `status = Recalled`; emit `Recalled`. **No external call to the market maker on this path** |
| `claim(token)` | anyone with `owed` | `owed > 0` | zero first, then transfer (checks-effects-interactions); emit `Claimed` |

Views: `getCharter(id)`, `getEpoch(id, e)`, `currentDepth(id) returns (below, above, inBand)`, `projectedScore(id) returns (scoreBps, projectedPayout)`, `owedOf(account, token)`.

Term end: when `now ≥ termEnd`, steering is disabled (`TermEnded`), epochs stop accruing at `termEnd`, and the issuer recalls.

### 5.4 DepthMath (the risky part — build first)

Definitions for a position `(tickLower, tickUpper, L)` at current `sqrtP` / `tick`, with band half-width `b` ticks:

- Band ticks: `bandLo = tick − b`, `bandHi = tick + b` (clamped to `TickMath.MIN_TICK/MAX_TICK`).
- **Below price (inside band):** price interval `[max(tickLower, bandLo), min(tickUpper, current)]`.
  `sqrtA = max(sqrtAt(tickLower), sqrtAt(bandLo))`, `sqrtB = min(sqrtAt(tickUpper), sqrtP)`.
  If `sqrtA < sqrtB`: `amount1Below = SqrtPriceMath.getAmount1Delta(sqrtA, sqrtB, L, false)` (round down = conservative).
- **Above price (inside band):** `sqrtA = max(sqrtP, sqrtAt(tickLower))`, `sqrtB = min(sqrtAt(tickUpper), sqrtAt(bandHi))`.
  If `sqrtA < sqrtB`: `amount0Above = SqrtPriceMath.getAmount0Delta(sqrtA, sqrtB, L, false)`.
- **Value in quote units** at the current price `P = sqrtP² / 2¹⁹²` (raw units):
  - quote is currency1: `below = amount1Below`; `above = mulDiv(mulDiv(amount0Above, sqrtP, 2⁹⁶), sqrtP, 2⁹⁶)`.
  - quote is currency0: `above = amount0Above`; `below = mulDiv(mulDiv(amount1Below, 2⁹⁶, sqrtP), 2⁹⁶, sqrtP)`.
- `inBand = below ≥ targetDepth && above ≥ targetDepth`.

`sqrtAt(t)` = `TickMath.getSqrtPriceAtTick(t)`. Use `FullMath.mulDiv` for every multiply-then-divide.

Implement as a pure library: `DepthMath.depthInBand(sqrtP, tick, tickLower, tickUpper, L, bandTicks, quoteIsCurrency1) returns (uint256 below, uint256 above)`.

**Properties to fuzz (Gate 1):**
1. Range entirely outside the band → `(0, 0)`.
2. Monotonic in `L`: doubling `L` doubles depth (± 1 wei rounding).
3. Band covering the whole range → `below + above` equals the position's token amounts at current price (via `LiquidityAmounts`/`SqrtPriceMath`, same valuation), ± rounding.
4. Widening the band never decreases depth.
5. Price below the range → `below == 0`; price above the range → `above == 0`.
6. No reverts for any valid tick in `[MIN_TICK, MAX_TICK]` and `L ≤ type(uint128).max / 2`.
7. TS mirror (`packages/sdk/src/depth.ts`, BigInt) matches Solidity on 1,000 random cases (write the cases to JSON from a Foundry test with `vm.writeJson`, assert in a vitest).

### 5.5 Accrual and epochs

```
_accrue(id):
  c = charters[id]
  t = min(now, termEnd)
  while c.lastAccrual < t:
      epochEnd = c.epochStart + c.epochLength
      segEnd   = min(t, epochEnd)
      dt = segEnd − c.lastAccrual
      c.belowDepthSeconds += c.cachedBelow * dt
      c.aboveDepthSeconds += c.cachedAbove * dt
      if c.cachedBelow ≥ target && c.cachedAbove ≥ target: c.secondsInBand += dt
      c.lastAccrual = segEnd
      if segEnd == epochEnd: _closeEpoch(id, epochEnd)     // starts next epoch at epochEnd
      guard: at most MAX_EPOCHS_PER_ACCRUE iterations per call (settle can continue)
```

- **afterSwap:** if pool has a charter and status ≠ Recalled: `_accrue`, read `getSlot0`, recompute `(cachedBelow, cachedAbove)` with DepthMath, emit `DepthUpdated(id, below, above, inBand)`. Keep it to reads + a few SSTOREs; no external token calls. Return `(selector, 0)`.
- **Exactness.** Depth only changes when price moves (swaps) or the position changes (steer/poke/recall). Every such event calls `_accrue` *before* the change and recaches *after*, so the accumulator is exact for depth measured at the pool price.
- **`_closeEpoch(id, end)`:** duration `T = end − epochStart`. Scores in bps:
  - `belowBps = min(10000, belowDepthSeconds × 10000 / (target × T))`, same for above.
  - `depthBps = min(belowBps, aboveBps)`.
  - `uptimeBps_ = min(10000, secondsInBand × 10000 / (uptimeTarget × T / 10000))`.
  - `scoreBps = depthBps × uptimeBps_ / 10000`.
  - `budget = retainerPerEpoch × T / epochLength` (capped at `retainerRemaining`).
  - `payout = budget × scoreBps / 10000`; `refund = budget − payout`.
  - `owed[marketMaker][retainerToken] += payout`; `owed[issuer][retainerToken] += refund`; `retainerRemaining −= budget`.
  - Store `EpochResult`, emit `EpochClosed(...)` with every field (the league is built from this event), reset accumulators, `epochIndex++`, `epochStart = end`.
- Use `uint256` for depth-seconds: target ≤ 2¹²⁸ and T ≤ 2³² fits easily. Check `target × T` cannot overflow given global caps.

### 5.6 Liquidity operations (unlock flow)

```
_modify(id, ops[]):            // ops = remove-all / add(range, liquidity)
  poolManager.unlock(abi.encode(id, ops))

unlockCallback(data):          // onlyPoolManager AND only while _unlocking == true (set by _modify)
  for op in ops:
     (callerDelta, feesAccrued) = poolManager.modifyLiquidity(key, params(op, salt = bytes32(id)), "")
     sum deltas; credit feesAccrued to fees0/fees1 (they are inside callerDelta)
  for each currency: d = net delta
     d < 0 → CurrencySettler.settle(currency, poolManager, address(this), uint256(-d), false)
     d > 0 → CurrencySettler.take(currency, poolManager, address(this), uint256(d), false)
  update idle0/idle1 = previous idle − paid + received − feesAccrued (fees tracked separately)
```

- Liquidity to add: `LiquidityAmounts.getLiquidityForAmounts(sqrtP, sqrtAt(tl), sqrtAt(tu), idle0, idle1)`. Leftover stays idle (the bot should choose ranges that use inventory well; a single-sided "reserve" position is a stretch goal).
- Sign convention (verify in source): negative delta = hook owes the pool; positive = pool owes the hook.
- `_unlocking` flag: set before `unlock`, cleared after. `unlockCallback` reverts `UnauthorizedCallback` if `msg.sender != poolManager` or `!_unlocking` (I3).
- Re-check after each op that the hook's real token balances ≥ Σ tracked balances (I6 in tests).

### 5.7 Events and errors

```solidity
event CharterCreated(uint256 indexed id, PoolId indexed poolId, address indexed issuer, address marketMaker,
                     address understudy, int24 tickLower, int24 tickUpper, uint128 liquidity, CharterParams params);
event Steered(uint256 indexed id, address indexed marketMaker, int24 tickLower, int24 tickUpper, uint128 liquidity);
event Pinged(uint256 indexed id, address indexed marketMaker);
event Poked(uint256 indexed id, address indexed poker, int24 tickLower, int24 tickUpper, uint128 liquidity);
event UnderstudySet(uint256 indexed id, address indexed understudy);
event HandedOver(uint256 indexed id, address indexed from, address indexed to);
event DepthUpdated(uint256 indexed id, uint256 below, uint256 above, bool inBand, int24 tick, uint160 sqrtPriceX96);
event EpochClosed(uint256 indexed id, uint32 indexed epoch, address indexed marketMaker, uint64 start, uint64 end,
                  uint256 belowDepthSeconds, uint256 aboveDepthSeconds, uint64 secondsInBand,
                  uint16 scoreBps, uint256 payout, uint256 refund);
event Recalled(uint256 indexed id, uint256 amount0, uint256 amount1, uint256 fees0, uint256 fees1);
event Claimed(address indexed account, address indexed token, uint256 amount);

error NotIssuer();            // I1
error NotMarketMaker();       // I1
error WrongHook();            // I2
error PoolAlreadyChartered(); // I2
error UnauthorizedCallback(); // I3
error RangeMustContainPrice();// I4
error RangeWidthOutOfBounds();// I4
error RangeNotAligned();      // I4
error ParamsOutOfBounds();    // I4
error DonationsDisabled();    // I7
error HeartbeatNotStale();    // I9
error NoUnderstudy();         // I9
error CharterNotActive();
error TermEnded();
error NothingToClaim();
```

Error names are shown verbatim in the red-team panel; keep them readable.

### 5.8 Global caps (immutable constants)

| Constant | Value | Reason |
|---|---|---|
| `MIN_BAND_TICKS` / `MAX_BAND_TICKS` | 10 / 2000 | ±0.1% … ±~22% |
| `MIN_WIDTH_FLOOR` / `MAX_WIDTH_CEIL` | 20 / 40000 | Charter bounds must sit inside these (Gamma's script error lesson) |
| `MIN_EPOCH` / `MAX_EPOCH` | 60 s / 30 days | Demo needs 120 s |
| `MIN_GRACE` | 30 s | |
| `MAX_EPOCHS` | 1000 | Term cap |
| `MAX_EPOCHS_PER_ACCRUE` | 32 | Bounded loops |
| `MAX_TARGET_DEPTH` | 2¹²⁸ − 1 | Overflow safety |

### 5.9 Skeleton

```solidity
contract LeadlineHook is BaseHook, IUnlockCallback, ILeadline {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    uint256 public nextId = 1;
    bool private _unlocking;

    constructor(IPoolManager pm) BaseHook(pm) {}

    function getHookPermissions() public pure override returns (Hooks.Permissions memory p) {
        p.afterSwap = true;
        p.beforeDonate = true;
    }

    function _afterSwap(address, PoolKey calldata key, SwapParams calldata, BalanceDelta, bytes calldata)
        internal override returns (bytes4, int128)
    {
        uint256 id = charterOf[key.toId()];
        if (id != 0 && charters[id].status != Status.Recalled) { _accrue(id); _recache(id); }
        return (this.afterSwap.selector, 0);
    }

    function _beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        internal pure override returns (bytes4) { revert DonationsDisabled(); }

    // createCharter, steer, ping, poke, setUnderstudy, handover, settle, recall, claim — §5.3
    // _accrue, _closeEpoch — §5.5 ; _modify, unlockCallback — §5.6 ; _recache uses DepthMath — §5.4
}
```

Check the exact internal hook function names/signatures in the installed OZ `BaseHook` before writing them.

---

## 6. Security invariants

Each invariant is a Foundry invariant or fuzz test **and** a red-team card in the UI.

| # | Invariant | How it's enforced | Test | Incident it answers |
|---|---|---|---|---|
| I1 Custody | Charter inventory leaves the hook only to the issuer | No function transfers principal/idle/fees except `recall` (issuer-only); `claim` pays only `owed`; MM functions never call `take` to an external address | Invariant: Σ tokens received by non-issuer accounts == Σ their `owed` claims | Movement-style dumps; Visor, Concentric key compromises |
| I2 Pool binding | A charter's PoolId is fixed; nothing accepts a caller-supplied `PoolKey` after creation | Only `createCharter` takes a key; checks `key.hooks == this`, one charter per pool | Attack test: swaps in an attacker-made pool with this hook change no charter state | Safe/rsETH module (Sept 2026, ~$7.7M) |
| I3 Caller auth | Callbacks only from PoolManager; unlock callback only for self-started unlocks; `hookData` never trusted | OZ `onlyPoolManager`; `_unlocking` flag | Direct calls to `unlockCallback`/`afterSwap` revert | Cork (May 2025, ~$11–12M) |
| I4 Bounded steering | Every range contains the current tick, is aligned, and width ∈ charter bounds ⊂ global caps | Checks in `steer`/`createCharter`; caps immutable | Fuzz steer inputs | Gamma (Jan 2024): 2% guard set to −50%/+100% |
| I5 No swap path | MM can't swap charter inventory | No swap call exists in the hook; re-ranging is remove/add only | Static: grep + test that hook never calls `swap` | DRLVaultV3 (Nov 2025) |
| I6 Conservation | Per token: hook balance ≥ Σ(idle + fees) + Σ owed + Σ retainerRemaining (+ liquidity in pool tracked separately); rounding favours the hook | Round down on outflows; tracked balances | Invariant over random action sequences | Bunni v2 (Sept 2025, ~$8.4M) |
| I7 Honest measurement | Accumulators only increase within an epoch; only own liquidity counts; donations blocked | DepthMath uses only the charter's `L`; `beforeDonate` reverts | Wash-trade test: 100 round-trip swaps leave depth-seconds within the no-trade baseline ± swap-induced price effect | Score padding |
| I8 Bounded pay | `payout ≤ budget × score`, `score ∈ [0,10000]`, each epoch closes once, Σ payouts + refunds ≤ total retainer | Formula + `epochIndex` monotonic | Invariant | Popsicle (Aug 2021, ~$20M) |
| I9 Liveness | Stale heartbeat ⇒ anyone can move to fallback; fallback only widens; handover preserves conservation | `poke`, `handover` | Unit + invariant | Keepers going dark |
| I10 Unblockable recall | `recall` succeeds whatever the MM does | Pull payments (`owed`), no MM call on recall path, no pause | Invariant: issuer can always recall; attacker MM contract that reverts on receive can't block | Arcadia (Jul 2025, ~$3.6M) |

**Hardening checklist (L3):** Slither clean or justified; Trail of Bits' "Building secure Uniswap v4 hooks" checklist walked through and noted in `SECURITY.md`; fuzz DepthMath at MIN/MAX ticks and dust liquidity; confirm mined address has exactly the two permission bits; no `tx.origin`; no `delegatecall`; CEI everywhere.

---

## 7. Testing plan

- **Fixture** (`LeadlineFixture.sol`): deploy PoolManager + `PoolSwapTest` + `PoolModifyLiquidityTest` (v4-core test utils), two `MockERC20`s (`TIDE` 18 dp, `USDC` 6 dp), mine + deploy hook with `HookMiner`, initialise TIDE/USDC pool at a sane price, add outside LP liquidity so swaps work beyond the charter, create a default charter.
- **Unit tests:** one file per function (§3 list). Each revert path tested by error selector.
- **Fuzz:** DepthMath properties (§5.4), steer inputs, epoch maths with random swap timing.
- **Invariant:** `LeadlineHandler` actions: `swap(random size, direction)`, `warp(1..300 s)`, `steer(random range)`, `ping`, `poke`, `handover`, `settle`, `claim`, `recall`, plus attacker actions (`attackerRecall`, `attackerSteer`, `attackerUnlockCallback`, `attackerDonate`). Invariants I1, I6, I8, I10 checked after every call. Run with `runs = 256, depth = 64` locally; bump for the final run.
- **Attacks** (`RedTeam.t.sol`): one test per red-team card (§11.6), asserting the exact error or "no state change".
- **Coverage:** `forge coverage` ≥ 90% lines on `LeadlineHook` + `DepthMath` by L3. Put the number in the README.
- **TS:** vitest for `sdk` (depth mirror vs Solidity JSON vectors, tick helpers, strategy decisions).

---

## 8. Deployment and scripts

**Local (demo default).**
1. `anvil --block-time 1` (fresh chain, 1 s blocks).
2. `forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast` → deploys PoolManager + test routers (use the v4-template local flow; check its README for exact script names), tokens, mines + deploys hook, initialises TIDE/USDC, adds outside liquidity, creates charter #1 with demo params (±2% band → 200 ticks at spacing 10; target per side e.g. 25,000 USDC; uptime 90%; epoch 120 s; grace 45 s; 30 epochs; retainer 500 USDC/epoch), funds demo accounts.
3. Script writes `packages/sdk/src/addresses.ts` (chainId 31337) — never paste addresses by hand.
4. `forge script script/SeedLeague.s.sol` creates 4–6 extra pools + charters with different fictional market makers, runs scripted steering/flows with `vm.warp`-style time travel (`evm_increaseTime` via cast in a TS seeder if simpler), so the league has history. Label them **demo market makers** in the UI. Use clearly fictional names (e.g. Leeward Desk, Saltmarsh Liquidity, Northline Markets, Brightwater MM).

**Testnet (L5).** `DeployTestnet.s.sol` against Unichain Sepolia: use the deployed PoolManager address from Uniswap's deployments page, mine the hook for that PoolManager, deploy, initialise a TIDE/USDC pool with mock tokens, create a charter, verify the contract on the explorer, run the bots for a few hours so there is real history. Record all addresses + tx hashes in README.

**Keys.** Local demo uses anvil's default accounts (issuer, MM, Understudy, attacker, swapper). Never reuse them anywhere real. Testnet keys live in `.env` (gitignored) and are throwaway.

---

## 9. SDK package (`packages/sdk`)

- `abi.ts` — `wagmi generate` (Foundry plugin reading `contracts/out`). Commit generated output.
- `addresses.ts` — written by deploy scripts; `{ [chainId]: { hook, poolManager, swapRouter, tide, usdc, poolId } }`.
- `ticks.ts` — `pctToTicks(pct)` = `round(ln(1+pct)/ln(1.0001))`; `alignDown/alignUp(tick, spacing)`; `tickToPrice` with decimals; `formatPrice`.
- `depth.ts` — BigInt mirror of DepthMath; also `scoreEpoch(events, params, altBandTicks?)` for replay re-scoring.
- `strategy.ts` — `decide(state) → { action: 'steer', tickLower, tickUpper } | { action: 'ping' } | { action: 'wait' }`. Default strategy: re-centre when price leaves the middle 50% of the range or depth falls below 110% of target; choose width so idle inventory is minimised; ping when heartbeat age > 60% of grace. Deliberately simple: **Leadline's innovation is the hook, not the bot.**
- `flows.ts` — seeded PRNG (mulberry32) swap generators: `calm`, `volatile`, `pump(pct)`, `dump(pct)`, `wash(n)`.

## 10. Bots (`bots/`)

- `mm.ts --charter 1 --interval 3 --die-after 90` — loops `strategy.decide`, sends `steer`/`ping`; `--die-after` simulates going dark.
- `flow.ts --mode volatile --seed 7 --rate 2` — sends swaps through the router.
- `attacks.ts --attack custody|steer-far|donate|wash|callback|pool-key|double-settle` — runs one attack, prints result.
- All bots read addresses from the SDK, log one line per action, exit cleanly on Ctrl-C.

The web app's **demo autopilot** imports the same `strategy.ts`/`flows.ts`, so the live demo needs no separate processes (§11.7). CLI bots exist for the testnet run and for credibility in the repo.

---

## 11. Frontend (`apps/web`)

### 11.1 Design concept: the chart room

Leadline is about **sounding depth**, so the interface borrows from hydrographic survey charts: cool chart-paper white, survey-blue ink, depth tints, and the one colour charts reserve for things that matter, **chart magenta** (on real nautical charts, lights and important limits are printed in magenta). It should feel like a precise instrument, not a crypto dashboard. Most hookathon UIs will be near-black with a neon accent; Leadline will be the light, calm, exact one, and it projects well on demo-day screens.

**Spend boldness in one place: the Sounder** (§11.4). Everything around it is quiet: hairline rules, generous whitespace, tabular numbers, no shadows, no gradients, no card grid.

**Design plan review (done before building).** The obvious default for this brief would be a dark dashboard with a neon accent and identical rounded cards, or a cream page with a serif headline and clay accent. This plan avoids both: the background is a cool chart white, the accent is magenta used only for the lead line, live state and focus, and panels are separated by rules rather than cards. The italic serif is used only where charts use sloping lettering (titles and depth soundings), not as a generic "editorial" look. Labels are sentence case, never tracked-out caps; numbers use tabular sans figures, not a monospace label font; buttons don't carry arrows.

### 11.2 Tokens

**Colour** (CSS variables in `app/globals.css`, mapped into Tailwind v4 `@theme`):

| Token | Hex | Use |
|---|---|---|
| `--paper` | `#F6F8F7` | Page background (deep water on a chart is white) |
| `--shoal` | `#D3E6EF` | Depth tint: delivered depth fills, selected rows |
| `--survey` | `#1B3B55` | Primary text, primary buttons, axis ink |
| `--contour` | `#3F7FAF` | Data lines, below-price depth, links |
| `--buff` | `#E7DAB3` | Above-price depth fill (land tint), secondary highlights |
| `--magenta` | `#B0287C` | The lead line, live beacon, band limits, focus ring. Nothing else |
| `--rule` | `#C8D5DD` | Hairlines, table rules, neatline |
| `--muted` | `#5B6E7D` | Secondary text |
| `--kelp` | `#2F6E46` | In band, attack blocked, claimable |
| `--ochre` | `#A86B14` | Heartbeat ageing, out of band |
| `--rust` | `#A33A2B` | Fallback, breach, failed transaction |

Contrast: `--survey`, `--muted`, `--kelp`, `--ochre`, `--rust`, `--magenta` all pass WCAG AA on `--paper` for text ≥ 14 px; verify with a checker on Day 9 and adjust lightness if any fail.

Optional (stretch): "Night watch" dark variant: paper `#0E1A24`, survey `#E4EEF3`, magenta `#E05AAE`.

**Type**

| Role | Face | Setting |
|---|---|---|
| Page titles, charter names, soundings (depth numbers in the Sounder and score) | **Newsreader**, italic (Google Fonts) | Titles 39/44, weight 500; soundings tabular figures |
| Everything else (UI, body, tables, buttons) | **Instrument Sans** (Google Fonts) | Body 16/24; UI 14/20; small 12.8/18; tabular numbers everywhere numeric (`font-variant-numeric: tabular-nums`) |

Scale (ratio 1.25): 12.8 · 16 · 20 · 25 · 31 · 39 · 49. Load both with `next/font/google`. Line length ≤ 72 characters for prose. Left-aligned throughout; nothing centred except the landing headline block.

**Space and shape:** 4 px base; gutters 24; section spacing 48 (console) / 96 (landing). Controls radius 6. Panels have no radius and no shadow: they're separated by 1 px `--rule` lines and space. The Sounder alone gets a chart **neatline**: a double hairline frame with alternating graduation ticks along the top edge marking price steps, like latitude graduations on a chart border. Popovers get one soft shadow.

**Motion** (`motion` library):
- **The one orchestrated moment:** on every `DepthUpdated`, the lead weight in the Sounder moves to the new seabed depth with a spring (stiffness 170, damping 22), and the sounding numbers roll with NumberFlow. This is the heartbeat of the demo; nothing else on the page moves on its own.
- Page load: the seabed profile draws left to right once (600 ms, ease-out). No section fade-ins.
- User-triggered only: drawers slide (200 ms), red-team results expand (180 ms), toasts.
- `prefers-reduced-motion`: springs snap, the profile appears without drawing.

### 11.3 Information architecture

| Route | Page | Purpose |
|---|---|---|
| `/` | Landing | The live Sounder of charter #1 as the hero; what Leadline is; links |
| `/charters/[id]` | Console | The main demo screen: Sounder, score notes, epoch strip, log, role actions |
| `/charters/[id]/notices` | Notices to Mariners | Red-team panel |
| `/charters/[id]/replay` | Replay | Scrub history, re-score with a different band |
| `/charters/new` | Charter composer | Write and create a charter |
| `/league` | Proving Ground | Market makers ranked by delivered depth |
| `/league/[address]` | Market maker | One market maker's record across charters |

Global header (quiet): wordmark "Leadline" in Newsreader italic, nav (Charters, Proving Ground, Write a charter), chain badge (Local / Unichain Sepolia), role switcher in demo mode, connect wallet otherwise.

### 11.4 The Sounder (signature component)

A live hydrographic cross-section of the charter's liquidity.

```
 ┌─╥─┬─╥─┬─╥─┬─╥─┬─╥─┬─╥─┬─╥─┬─╥─┬─╥─┐  ← neatline, graduations = price steps
 │ 0.0941      0.0960   │price 0.0980   0.1000     0.1019 │  ← price labels (tabular)
 │        ┆−2%                     ║                 +2%┆        │
 │════════┆═══════════ surface ════║═══════════════════┆════════│
 │        ┆▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒║░░░░░░░░░░░░░░░░░░░┆        │
 │        ┆▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒║░░░░░░░░░░░░░░░░░░░┆        │
 │ - - - -┆- - - - - - - - - - - - ║ - - - - - - - - - ┆- - - - │  ← target contour (dashed)
 │        ┆▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒◆░░░░░░░░░░░░░░░░░░░┆        │  ← lead weight on the seabed
 │        ┆                 27 400 │ 21 900             ┆        │  ← soundings (italic)
 └────────┴────────────────────────┴────────────────────┴────────┘
   below price: contour-blue fill    above price: buff fill
```

- **X axis:** price, log scale, centred on the current price, default view ±6%, scroll to zoom ±1% … ±30%.
- **Surface:** top line. The charter's liquidity hangs downward as water depth: for each price bucket (≈ 120 buckets across the view), depth ∝ quote value of the charter's liquidity in that bucket. Below price filled `--contour` at 35% opacity, above price `--buff`. Other LPs' liquidity (optional) as a pale `--shoal` silhouette behind.
- **Band limits:** two magenta dashed verticals labelled "−2%" / "+2%" in Newsreader italic; area outside the band dimmed to 40%.
- **Range edges:** the position's `tickLower`/`tickUpper` as short survey-ink ticks on the surface with small labels on hover.
- **Lead line:** a 1.5 px magenta vertical from the surface at the current price to the seabed, ending in a lead weight (a small rounded trapezoid). This is the animated element.
- **Target contour:** a dashed `--survey` line at the depth where cumulative depth per side would equal the target if spread across the band; label "target 25 000 per side". (It's a visual cue; the authoritative numbers are the soundings.)
- **Soundings:** under the seabed on each side of the lead line, the cumulative in-band depth below and above price in Newsreader italic tabular figures, coloured `--kelp` when ≥ target, `--ochre` when below.
- **States:** Out of band → the side(s) below target pulse once in ochre (no looping). Fallback → profile goes rust-tinted and a note appears on the surface: "Fallback range: the market maker missed its heartbeat." Recalled → profile empty, note "Recalled by the issuer."
- **Accessibility:** `role="img"` with a live `aria-label` summarising "Depth below price 27,400 of 25,000 target; above price 21,900 of 25,000; in band: no." Data also visible in Chart notes.
- **Implementation:** SVG, d3-scale for x/y, computed from `sdk/depth.ts` per bucket using the charter's `(tickLower, tickUpper, liquidity)` and current `sqrtPriceX96`. Re-render on `DepthUpdated`/`Steered`/`Poked`. Memoise buckets; only the lead weight animates.

### 11.5 Console (`/charters/[id]`) — the demo screen

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Leadline   Charters  Proving Ground  Write a charter          Local ● Role: Issuer ▾ │
├────────────────────────────────────────────────────────────────────────────────────┤
│ TIDE / USDC charter                                     ● Live · steered 12 s ago    │
│ Market maker Leeward Desk (0x7099…79C8) · Understudy Saltmarsh (0x3C44…93BC)        │
│ Epochs ▮▮▮▮▮▮▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯▯  epoch 7 of 30 · closes in 1:24               │
├──────────────────────────────────────────────────────────┬─────────────────────────┤
│                                                          │ Chart notes             │
│                      THE SOUNDER                         │ 83%                     │
│                                                          │ of target this epoch    │
│                                                          │ ───────────────────────  │
│                                                          │ Below price  27 400/25 000│
│                                                          │ Above price  21 900/25 000│
│                                                          │ Time in band   86% / 90% │
│                                                          │ Projected pay  415 / 500 │
│                                                          │ Fees to issuer  38.20    │
│                                                          │ ───────────────────────  │
│                                                          │ [ Steer ] [ Ping ]       │  ← role actions
├──────────────────────────────────────────────────────────┴─────────────────────────┤
│ Log                                                                                  │
│ 12 s  Steered     Leeward Desk   range 0.0952 – 0.1008   liquidity 1.2e21   tx ↗    │
│ 14 s  Swap        0xf39F…2266    bought 1,200 TIDE        depth ↓ below    tx ↗     │
│ 2 m   Epoch 6     closed         score 91% · paid 455 USDC · refund 45             │
└────────────────────────────────────────────────────────────────────────────────────┘
```

(The middle dots in this wireframe are shorthand; in the UI, separate facts with layout and spacing, not "A · B · C" strings.)

- **Header:** charter title in Newsreader italic; status beacon (magenta dot that pulses only when a new block arrives; text "Live", "Out of band", "Heartbeat stale", "Fallback", "Recalled" in the matching status colour); people with role labels and short addresses (copy on click).
- **Epoch strip:** one segment per epoch across the term, like a tide table row. Closed epochs filled with a score-shaded `--contour` (darker = higher score), missed epochs (score < 80%) outlined in ochre, current epoch filling in real time. Hover shows that epoch's result.
- **Chart notes** (right rail): the projected score as a large italic sounding with "of target this epoch" beneath; rows with value / target; projected payout; fees to issuer; heartbeat age (turns ochre past 60% of grace, rust when stale). Then the **role actions**:
  - Market maker: Steer (opens a small range editor: drag range handles on the Sounder or type prices; shows "contains price ✓ width ✓" checks before sending), Ping.
  - Issuer: Set understudy, Hand over (disabled with reason if no understudy), Recall (confirm dialog: "Recall returns all inventory and fees to you and ends the charter. The market maker is paid for the time so far.").
  - Anyone: Poke (enabled only when stale, with countdown "available in 0:18"), Settle.
  - Claim appears for whoever has `owed` balance.
- **Log:** newest first, relative times, actor names for known roles, plain-language event descriptions, explorer link on testnet. Filter chips: All, Steering, Swaps, Epochs, Liveness.
- **Errors:** contract errors are mapped to plain sentences with the invariant tag, e.g. `RangeMustContainPrice` → "The new range must contain the current price. (I4 Bounded steering)".

### 11.6 Notices to Mariners (`/charters/[id]/notices`) — red-team panel

Real nautical publications called *Notices to Mariners* warn ships of new hazards; here each notice is an attack the judge can run. Notices are numbered because the real ones are.

Each notice: number, title, the incident it replays (one line with loss figure), what it tries (one sentence), **Run attack** button, and an inline result area.

| # | Title | Replays | Expected result |
|---|---|---|---|
| 1 | Withdraw the inventory to the market maker | Movement (2025) | Reverted `NotIssuer` — I1 Custody |
| 2 | Pull liquidity straight from the pool | Visor, Concentric key thefts | Reverted in PoolManager: the position belongs to the hook — I1 |
| 3 | Steer the range far from the price | Gamma (Jan 2024) | Reverted `RangeMustContainPrice` — I4 |
| 4 | Steer a razor-thin range | Gamma | Reverted `RangeWidthOutOfBounds` — I4 |
| 5 | Call the hook's unlock callback directly | Cork (May 2025, ~$11–12M) | Reverted `UnauthorizedCallback` — I3 |
| 6 | Wash-trade 100 swaps to pad the score | Score gaming | Ran: fees +X, Proof of Depth unchanged (before/after shown) — I7 |
| 7 | Donate to the range | Score gaming | Reverted `DonationsDisabled` — I7 |
| 8 | Poke while the market maker is alive | Griefing | Reverted `HeartbeatNotStale` — I9 |
| 9 | Settle the same epoch twice | Popsicle (Aug 2021, ~$20M) | Second settle changes nothing — I8 |
| 10 | Route through an attacker-made pool | Safe/rsETH module (Sept 2026, ~$7.7M) | Swaps run; charter state untouched — I2 |
| 11 | Block the issuer's recall | Arcadia (Jul 2025, ~$3.6M) | Market maker is a contract that reverts on receive; recall still succeeds — I10 |

Result styling: a blocked attack shows a kelp-green stamp **Blocked** with the error name and invariant; a "ran but changed nothing" result shows a before/after pair of soundings. Transaction hash and revert data available in a disclosure. A summary line at the top counts results: "11 notices run, 11 held."

### 11.7 Demo mode and stage mode

- **Demo mode** (on automatically on chain 31337): the role switcher uses anvil's default accounts (Issuer, Market maker, Understudy, Anyone, Attacker), so there are no wallet pop-ups on stage. Show a small note "Demo accounts on a local chain."
- **Demo drawer** (key `D`): swap flow (Calm, Volatile, Pump 8%, Dump 8%, Wash 100), market-maker autopilot on/off (the "Kill the bot" switch), Fast-forward to epoch end (anvil `evm_increaseTime` + `evm_mine`, local only), Reset scenario (re-runs the local deploy via a tiny API route that shells out to the deploy script, or reload a saved anvil state with `anvil --load-state`).
- **Autopilot:** runs `sdk/strategy.ts` in the browser with the market-maker key every 3 s; the swap flow runs `sdk/flows.ts` with the swapper key. Same code as the CLI bots.
- **Stage mode** (key `S`): 125% type scale, header hidden, Sounder and Chart notes only plus log, thicker lines, larger soundings, cursor halo. For projectors.
- Keyboard map shown with `?`.

### 11.8 Charter composer (`/charters/new`)

Two columns: form on the left, live preview on the right (a mini Sounder showing the band, target contour and the initial range on the current pool, plus a cost summary).

Form sections (plain headings, no step numbers since fields can be filled in any order):
- **Pool and inventory:** pool (select), TIDE amount, USDC amount, initial range (auto-centred, editable).
- **Depth terms:** band (slider ±0.5% … ±10%, shown in % and ticks), target depth per side (USDC), range width bounds.
- **Time terms:** epoch length, number of epochs (term), heartbeat grace, uptime target.
- **Pay:** retainer per epoch; summary "Escrow 15,000 USDC for 30 epochs. The market maker earns up to 500 USDC per epoch, in proportion to depth delivered."
- **People:** market maker (pick from Proving Ground with their delivered score shown, or paste address), Understudy (optional).

Create flow: a checklist of transactions (Approve TIDE, Approve USDC, Create charter) with live states (waiting, confirming, done, failed with reason). On success: toast "Charter created" and navigate to the Console.

Validation mirrors the contract's global caps; the button explains why it's disabled.

### 11.9 Proving Ground (`/league`) and profiles

A tide-table: dense, numeric, sortable. Built from `EpochClosed` events across all charters.

| Column | Meaning |
|---|---|
| Market maker | Name (demo label) + short address |
| Delivered | Time-weighted mean score across all closed epochs |
| Time in band | Mean of `secondsInBand / T` |
| Missed epochs | Epochs with score < 80% |
| Charters | Active / total |
| Last 12 epochs | Tiny bar strip, one bar per epoch, height = score |
| Handed over | Times replaced via handover (a reputation hit) |

Default sort by Delivered. Clicking a row opens `/league/[address]`: header with the market maker's totals, then one row per charter with its epoch strip, and a list of handovers/pokes. Empty state: "No closed epochs yet. Run a charter for one epoch to appear here."

Demo market makers are labelled as such.

### 11.10 Replay (`/charters/[id]/replay`)

- Timeline scrubber across the charter's history (epoch boundaries marked). Dragging re-renders the Sounder at that moment (price from `DepthUpdated`, position from `Steered`/`Poked`).
- **Re-score:** band options (±1%, ±2%, ±5%, custom). For each closed epoch, show actual score vs re-scored (computed client-side with `sdk/depth.ts` from the event history) as paired bars. Copy: "With a ±1% band, this market maker would have delivered 64% instead of 83%."
- This is the "backtesting" bullet of the theme.

### 11.11 Landing (`/`)

- Hero: the **live Sounder** of charter #1 (compact, read-only), with the headline in Newsreader italic beside it: "Let the pool prove the depth." Sub-copy (≤ 2 lines): "Leadline holds a token issuer's liquidity in a Uniswap v4 hook. Market makers can steer it but never take it, and they're paid only for the depth they deliver." Buttons: "Open the live charter", "Write a charter".
- How it works: a four-step sequence (numbered, because it is a sequence): Write a charter → Market maker steers → Pool measures depth → Pay follows delivery. One sentence each.
- Why it has to be a hook: three short points (scores every swap, owns the position, blocks donations).
- Who it's for: launchpad graduates, small stablecoins, tokenized assets.
- Footer: repo, video, deployed addresses, "Built for UHI11".

### 11.12 Data layer

- `lib/wagmi.ts`: chains = anvil (31337) + Unichain Sepolia (check the chain object name in `viem/chains`); transports with 1 s polling on local.
- `hooks/useCharter(id)`: multicall reads (`getCharter`, `currentDepth`, `projectedScore`, `getSlot0` via StateView or the hook's view).
- `hooks/useCharterEvents(id)`: `getLogs` from the deploy block (address book stores it) + `watchContractEvent` for live updates; normalises into a typed timeline (`CharterEvent[]`) kept in TanStack Query cache.
- `hooks/useLeague()`: all `EpochClosed` + `HandedOver` + `Poked` logs → aggregates per market maker. Fine for demo scale; Ponder is a stretch.
- `lib/errors.ts`: decode custom errors with viem `decodeErrorResult` → `{ message, invariant }`.
- `lib/format.ts`: token amounts (tabular, thin-space thousands), prices, durations ("1:24", "12 s ago"), addresses.

### 11.13 Component inventory

`Sounder`, `LeadWeight`, `Neatline`, `SoundingValue` (italic NumberFlow), `EpochStrip`, `ChartNotes`, `ScoreRow`, `StatusBeacon`, `RoleSwitcher`, `RoleActions`, `RangeEditor`, `LogTable`, `NoticeCard`, `ResultStamp`, `LeagueTable`, `ScoreStrip`, `ReplayScrubber`, `RescoreBars`, `TxChecklist`, `DemoDrawer`, `StageModeProvider`, `Toast`, `ConfirmDialog`, `AddressChip`, `EmptyState`.

Use shadcn/ui primitives only for behaviour (Dialog, Popover, Tooltip, Slider, Tabs), restyled fully with the tokens above. Don't ship default shadcn looks.

### 11.14 Quality floor

- Responsive: designed at 1440 and 1280 (demo), stacks at ≤ 1024 (Chart notes under the Sounder), readable on mobile (League, Console summary).
- Keyboard: every action reachable; focus ring 2 px magenta with 2 px offset; shortcuts `D`, `S`, `?`.
- Reduced motion respected (§11.2).
- Loading: skeleton rules (hairlines), never spinners in the Sounder; empty states that say what to do next.
- Copy: sentence case; actions keep the same verb end to end (button "Hand over" → toast "Handed over" → log "Handed over to Saltmarsh"). Errors say what happened and how to fix it, without apologising.
- Review screenshots of every page on Day 15 at 1440, 1280, 768 and 390 widths; fix anything that looks templated.

---

## 12. Evidence track (runs in parallel; this is the moat)

**Outreach (Day 0–10).** Message 10 people: teams with recently graduated launchpad tokens (Doppler/Zora/Flaunch/Robinhood Chain launches), 2–3 small stablecoin or tokenized-asset issuers, 2 DEX market makers. Template:

> Hi [name], I'm building Leadline for the Uniswap Hook Incubator: a v4 hook where a token's market maker can steer the project's liquidity but can't withdraw it, and gets paid only for the depth it actually keeps near the price (measured onchain). Quick question: would you use (or accept, if you're a market maker) a deal like that instead of a token loan? Even a one-line answer helps. Happy to show a 2-minute demo.

Log replies in `analysis/outreach.md` (no private details in the public repo; ask permission before quoting by name).

**Real-pool analysis (Day 13–15)** — `analysis/launchpad-depth.ts`:
1. Pick 5–10 v4 pools of tokens that graduated from a launchpad in the last few months (find pool ids via the launchpad's docs/contracts or Dune).
2. Sample every hour for the first 30 days after graduation using an RPC with archive access: read `slot0` and active `liquidity` via the StateView contract at each block.
3. Approximate in-band depth from active liquidity: below = `L × (sqrtP − sqrtP·√0.98) / 2⁹⁶` (in token1 units), above similarly (assumes liquidity roughly constant across ±2%; label it as an approximation).
4. Output: share of hours with depth below a reference target (e.g. $10k per side), median depth by day. One chart for the README and pitch: "Depth within ±2% was below $X for Y% of the first 30 days."
5. Replay one real pool's price path through the Sounder in Replay mode if time allows.

---

## 13. Day-by-day plan with commits

Commit as each piece is done. Push daily. Messages use Conventional Commits. Tags mark gates. The commit lists are guides, not quotas: if a day produces three commits instead of six, that's fine.

| Day | Date | Work | Typical commits |
|---|---|---|---|
| 0 | Mon 16 Nov | Repo, BUILD.md, outreach | `chore: init pnpm workspace` · `docs: add BUILD.md and CLAUDE.md` · `chore(contracts): scaffold from v4-template` |
| 1 | Tue 17 Nov | Hook skeleton, permissions, HookMiner deploy in fixture, first test | `feat(hook): LeadlineHook skeleton with afterSwap and beforeDonate` · `test: fixture deploying pool manager, tokens and mined hook` · `test(hook): donations revert` |
| 2 | Wed 18 Nov | DepthMath + property fuzz | `feat(math): DepthMath.depthInBand` · `test(math): fuzz band, monotonicity and edge ticks` · `test(math): export vectors for TS mirror` |
| 3 | Thu 19 Nov | Charter storage, createCharter, unlock flow | `feat(hook): charter params, validation and global caps` · `feat(hook): createCharter adds hook-owned liquidity via unlock` · `test(hook): create happy path and revert cases` |
| 4 | Fri 20 Nov | Accrual + epochs; **Gate 1** | `feat(hook): accrue depth-seconds in afterSwap` · `feat(hook): close epochs with score and payout` · `test(hook): epoch scoring with timed swaps` · tag `gate-1-depth-maths` |
| 5 | Sat 21 Nov | steer, claim, recall; invariant handler (I1 I4 I6 I8) | `feat(hook): steer with bounded, swap-free re-ranging` · `feat(hook): pull-based claim and issuer recall` · `test(invariant): handler and custody, conservation, bounded pay` |
| 6 | Sun 22 Nov | Local deploy script, SDK (ABIs, addresses, depth mirror), CLI bots | `feat(script): DeployLocal writes address book` · `feat(sdk): generated ABIs and depth mirror` · `test(sdk): mirror matches Solidity vectors` · `feat(bots): mm and flow bots` |
| 7 | Mon 23 Nov | Web scaffold, tokens, fonts, Console reading live state; **L1 done** | `feat(web): Next.js app with chart-room tokens` · `feat(web): console reads charter and log` · tag `v0.1.0-core-loop` |
| 8 | Tue 24 Nov | ping, poke, fallback, handover, setUnderstudy (I9) | `feat(hook): heartbeat, poke to fallback range` · `feat(hook): handover closes epoch and swaps in understudy` · `test(hook): liveness and handover` |
| 9 | Wed 25 Nov | The Sounder + Chart notes + epoch strip | `feat(web): Sounder cross-section with band and lead line` · `feat(web): chart notes and epoch strip` · `fix(web): contrast pass on status colours` |
| 10 | Thu 26 Nov | Charter composer, role switcher, demo drawer, autopilot; **L2 done** | `feat(web): charter composer with live preview` · `feat(web): demo accounts, drawer and autopilot` · tag `v0.2.0-liveness` |
| 11 | Fri 27 Nov | Hardening: I2 I3 I5 I7 I10 tests, Slither, SECURITY.md | `test(attacks): red-team suite` · `fix(hook): <findings>` · `docs: SECURITY.md with checklist walk-through` |
| 12 | Sat 28 Nov | Notices to Mariners UI + attacks CLI; **L3 done** | `feat(web): notices to mariners red-team panel` · `feat(bots): scripted attacks` · tag `v0.3.0-hardened` |
| 13 | Sun 29 Nov | SeedLeague, Proving Ground, profiles; start real-pool analysis | `feat(script): seed league history` · `feat(web): Proving Ground and market maker profiles` · `feat(analysis): sample launchpad pools` |
| 14 | Mon 30 Nov | Replay + re-score; landing page; **L4 done** | `feat(web): replay scrubber and re-scoring` · `feat(web): landing with live sounder` · tag `v0.4.0-league` |
| 15 | Tue 1 Dec | Testnet deploy + verify, run bots for history, analysis chart, README, screenshot review; **L5 done** | `feat(script): Unichain Sepolia deployment` · `docs: README with addresses, invariants and evidence` · `fix(web): responsive and polish pass` · tag `v0.5.0-evidence` |
| 16 | Wed 2 Dec | **Feature freeze.** Stage mode, video, 3 rehearsals, final fixes | `feat(web): stage mode` · `docs: demo runbook and video link` · tag `v1.0.0` |
| 17 | Thu 3 Dec | Final submission form with Project ID, last rehearsal. Submit in your daytime (deadline is 08:59 Fri 4 Dec in Lagos) | none needed |

If a day slips: move the slipped item to the next day and drop from the end of the *later* layers (League → Replay → Landing order of cutting). Never cut tests for I1, I6, I8, I10.

Use the Atrium **Project Update form** (https://tally.so/r/m6lP9e) if the project changes materially; the **Final Submission form** is https://tally.so/r/mVNEAE and needs your Project ID.

---

## 14. Demo runbook (3 minutes live + questions)

**Before going on:** anvil running from saved state, web app on Console of charter #1 in Stage mode, autopilot on, flow "Calm", backup video open in another tab, testnet tab ready.

| Time | Action | Say |
|---|---|---|
| 0:00 | Landing, then Console | Hook line (§15 pitch) |
| 0:20 | Point at the Sounder; flow → Volatile | "Every swap, the pool measures the depth this market maker actually keeps near the price." |
| 0:45 | Notices 1, 3, 6 | "Let's try to steal the inventory… blocked. Steer away from the price… blocked. Fake the score with 100 wash trades… fees moved, depth didn't." |
| 1:30 | Demo drawer → Kill the bot; wait for stale; switch role to Anyone → Poke; role Issuer → Hand over | "The market maker went dark. Anyone can make the position safe, and the issuer hands it to the Understudy in one transaction." |
| 2:15 | Fast-forward to epoch end | "The epoch closes: the market maker delivered 83% and gets 83% of the retainer. The rest goes back to the issuer." |
| 2:35 | Proving Ground | "Every epoch becomes a scorecard. That's the track record a market maker can't fake." |
| 2:45 | Close | "Don't trust your market maker's report. Let the pool prove the depth." |

**Failure plans:** if anvil misbehaves, `anvil --load-state demo.json` (≤ 20 s) and continue; if the browser fails, switch to the backup video at the matching timestamp; if a judge asks for proof, open the verified testnet contract.

---

## 15. Submission package

**README outline:** one-line pitch · 90-second video · the problem (with sources) · how it works (lifecycle diagram) · why it must be a hook · invariants table with links to tests · red-team results · evidence (real-pool chart, outreach quote if permitted) · prior art and what's different · architecture · deployed addresses (Unichain Sepolia) · run it locally (3 commands) · test coverage · known limitations · roadmap.

**Video (≤ 3 min):** same flow as the runbook, recorded at 1440 in Stage mode, with captions. Keep a 60-second cut for social posts.

**Pitch script:** in the Leadline brief doc (Pitch script section). Fill the two placeholders (real-pool numbers, buyer quote) on Day 15.

**Checklist (Day 16):**
- [ ] All tests green; coverage number in README
- [ ] Slither run, findings resolved or justified in SECURITY.md
- [ ] Testnet contracts verified; addresses + tx hashes in README
- [ ] Video uploaded (unlisted is fine) and linked
- [ ] Repo public (it can stay private until submission day), licence added (MIT)
- [ ] Final submission form filled with the Project ID from the idea-form email
- [ ] Three clean rehearsals done

---

## 16. Known limitations (say them before judges do) and stretch backlog

**Limitations**
- A market maker can still trade against the issuer's liquidity from a separate wallet. The score pays for depth, not returns, and bounded ranges limit extraction, but it isn't zero.
- Depth is measured around the current pool price, not a TWAP; a market maker could briefly push the price into their range. It costs them fees and arbitrage, but a TWAP reference is the right fix (stretch).
- Market size is unproven: there's little data on how much new-token market making happens on DEXs versus centralised exchanges.
- One charter per pool; one position per charter (leftover inventory sits idle until the next steer).

**Stretch backlog (in order)**
1. TWAP reference price (OZ/Panoptic truncated-oracle pattern) for steering checks and depth measurement.
2. Reserve position: leftover inventory placed single-sided just outside the price.
3. Market-maker bond slashed on objective breach (missed epochs below a floor).
4. Net-sell cap on ask-side inventory per epoch.
5. Reactive Network automation for `poke` and `settle` (sponsor prize).
6. Launchpad integration: graduated tokens get a charter by default.
7. Ponder indexer for the league; scorecards as onchain attestations other protocols can read.
8. Night-watch dark theme.
