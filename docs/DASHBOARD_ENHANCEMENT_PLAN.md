# Dashboard Enhancement Plan — Atomic Design + the Option-Scalping Cockpit

> **Goal:** restructure `stock-analysis-portal` on **Atomic Design**, and build a single
> **Option-Scalping Cockpit** page that carries *every* datum needed to take (or refuse) a scalp —
> responsive, real-time, and safe by construction.
> **Status:** PLAN. Audited against the code on 2026-07-10.
>
> Read with: [`DASHBOARD_PLAN.md`](DASHBOARD_PLAN.md) (Phase 1, already built) ·
> [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md) (what the numbers mean) ·
> [`TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md) §6.2 (execution invariants the UI must expose).

---

## 0. TL;DR

1. **Fix three defects first** (below) — they will bite regardless of what we build on top.
2. **Adopt Atomic Design** with an *enforced* import rule (ESLint), not just folder names.
3. **Build `/scalp`** — one page, ~40 data points, six zones, one hero figure.
4. **One route per data domain**, front-end *and* API. Most API routes don't exist yet.
5. **Mobile-first**, because the kill switch must work from a phone.

---

## 1. Audit — what's actually there

**Stack (keep it):** Next.js 13 (pages router) · Tailwind (semantic tokens) · Redux Toolkit · SWR ·
socket.io-client · `lightweight-charts` (candles) · `chart.js` (bars/equity) · lucide-react.

### 🔴 Defects to fix before anything else

| # | Defect | Evidence | Why it matters |
|---|--------|----------|----------------|
| D1 | **Light theme is broken** | `ui/Card/Card.jsx` hardcodes `background:#1a1a2e`; `ui/Badge` hardcodes `#2a2a3e`; `ui/Button` hardcodes gradients — all in `styled-jsx` | `tailwind.config.js` sets `darkMode:'class'` and `ThemeToggle` exists, but the primitives **ignore both**. Two theming systems in one app: pages use semantic tokens, primitives use fixed dark hex. Light mode cannot work. |
| D2 | **No atomic layering** | `ui/` mixes atoms (`Button`,`Input`,`Badge`) with molecules (`Card`,`Modal`,`Table`,`Carousel`); `AIReasoning.js`, `ScoreGauge.js`, `MStockDashboard.jsx` sit loose at `components/` root; `.js`/`.jsx` used interchangeably | Nothing stops a "molecule" importing a page. Structure decays silently. |
| D3 | **Polling where push exists** | `/trading` polls every 3 s; `Navbar` every 5 s | Freshness is a *safety* property here, and `executionSlice`/`regimeSlice` already have `*Pushed` reducers waiting for socket rooms. |

> **Checked and cleared:** `features/Dashboard/index.js` + `index.jsx` (and the same in `Historical/`) look like
> the `strategies.js` shadowing bug but are **not** — `index.js` is a deliberate 39-byte re-export shim
> (`export { default } from './index.jsx'`). Both are live and intentional. Worth standardising the convention,
> not removing it.

### 🟡 Smaller issues
- `/trading` **polls every 3s**; the Navbar polls every 5s. Both should be socket-pushed.
- Domain folders inconsistent: `analysis/` (flat) vs `features/Analysis/components/` (nested).
- `features/Analysis/components/PCRPanel.jsx` and `StockChart.jsx` already exist — **reuse, don't rebuild**.

### ✅ Already good
`useStaleness`, `StatTile`, `RiskMeter`, `PositionsTable`, `TradeModeBadge`, `KillSwitchButton`,
`ConfirmDialog`, `StaleBadge`, `RegimeCard`, `executionSlice`, `regimeSlice`, trading formatters.

---

## 2. Atomic Design — the layering, and how it's enforced

Folder names don't create structure; an import rule does.

```
src/components/
  atoms/        no imports from any other layer. Pure, stateless, no data.
  molecules/    may import atoms.
  organisms/    may import atoms + molecules. Owns one bounded piece of UI.
  templates/    layout only. Grid areas + slots. No data, no business logic.
  (pages/)      src/pages/* — data wiring only: hooks + slices -> template + organisms.
```

**Enforce it** in `.eslintrc` — this is the part that makes it real:

```js
'no-restricted-imports': ['error', { patterns: [
  { group: ['**/molecules/*','**/organisms/*','**/templates/*'], message: 'atoms may not import upward' },
  // scoped per-folder via eslint overrides
]}]
```

### Migration map (existing → atomic). No big-bang rewrite.

| Layer | Members | From |
|-------|---------|------|
| **atoms** | `Button` `Input` `Badge` `Icon` `Spinner` `Skeleton` `StatusDot` `Chip` `Toggle` `Value` (numeric, `tabular-nums`) | `ui/Button`, `ui/Input`, `ui/Badge` (+ new) |
| **molecules** | `Card` `Modal` `Table` `StatTile` `RiskMeter` `StaleBadge` `TradeModeBadge` `KillSwitchButton` `ConfirmDialog` `RegimeChip` `TierChips` `SpreadChip` `OIDeltaCell` `CountdownChip` `SearchSelect` | `ui/Card`,`ui/Modal`,`ui/Table`, `trading/*` |
| **organisms** | `SafetyBar` `PriceChart` `OptionChainGrid` `OptionAnalyticsPanel` `RegimeCard` `BreadthPanel` `SectorHeatmap` `StrikePreviewCard` `ConfluenceChecklist` `PositionsTable` `OrdersTimeline` `SignalFeed` `DailyRiskCard` `BrokerHealthCard` `LatencyPanel` | `regime/RegimeCard`, `trading/PositionsTable`, `trading/DailyRiskCard`, `features/Analysis/StockChart`, `features/Analysis/PCRPanel`, `features/Dashboard/SignalsFeed` |
| **templates** | `CockpitTemplate` `TwoColTemplate` `DetailTemplate` `ListTemplate` | new (extract from `AppLayout`) |

**Rules that keep it honest**
- An organism owns **one** bounded concern and receives data via props or one selector hook. It never fetches.
- `Value` is the only place numbers get formatted → guarantees `—` for unknown and `tabular-nums` in columns.
- Atoms carry **no colour semantics**. `Value tone="pnl"` decides; a caller never passes `text-success`.

**D1 is a prerequisite:** convert `ui/` primitives from hardcoded `styled-jsx` hex to the Tailwind semantic
tokens (`bg-surface`, `border-border`, `text-text-primary`, `success|error|warning|info`) so both themes work.
Moving a primitive into `atoms/` while it still hardcodes `#1a1a2e` just relocates the problem.

### 2.4 TypeScript + decoupling — ports and adapters, in the UI too

The same discipline that fixed the brokers applies here: **a wrapper per external system, one stable internal
contract.** Types are how that contract is enforced instead of merely documented.

#### Layering (each arrow is the only legal direction)

```
shared/types (.ts)          ← the wire + domain contracts. Zero framework, zero React.
        ▲
   src/api/*.ts             ← ADAPTERS. The ONLY place `fetch` exists.
   (ExecutionApi, OptionsApi, RegimeApi, MarketApi)   wire DTO -> domain model
        ▲
   src/ports/*.ts           ← PORTS. Interfaces the UI depends on, not the impl.
        ▲
   store/slices/*.ts        ← state, typed selectors
        ▲
   organisms / molecules / atoms (.tsx)   ← pure props. Never fetch. Never import an adapter.
```

- **Organisms never fetch.** A page composes `useExecution()` (a hook over a port) and passes props down.
  Swap the adapter for a fake in tests/Storybook — the tree doesn't know or care.
- **`src/ports`** mirrors `BrokerAdapter`: `interface ExecutionPort { getState(): Promise<ExecutionState>;
  kill(): Promise<void>; squareOff(): Promise<void> }`. The Redux thunks depend on the *port*.

#### Types encode the safety rules (this is the real payoff)

Make the invariants unrepresentable rather than remembered:

```ts
// "Never render a confident 0" becomes a type error, not a code review note.
type Loaded<T> =
  | { status: 'loading' }
  | { status: 'unreachable'; reason: string }
  | { status: 'stale'; value: T; ageSeconds: number }
  | { status: 'fresh'; value: T };

// A P&L you cannot read without deciding what "unknown" looks like.
type Rupees = number & { readonly __brand: 'INR' };
type Premium = number & { readonly __brand: 'OPTION_PREMIUM' }; // ≠ index spot

// The bug that shipped: spot compared against premium. Branding makes it uncompilable.
function pnl(entry: Premium, ltp: Premium, lots: number, lotSize: number): Rupees;
```

`Premium` vs a spot price as *distinct branded types* would have caught the audit's showstopper
(`entryPrice` = index spot compared against option premiums) at compile time.

Similarly: `type TradeMode = 'paper' | 'shadow' | 'live'` and `type OptionType = 'CE' | 'PE'` —
a bearish signal maps to `'PE'`, never to a `SELL` action, matching `TARGET_ARCHITECTURE.md` §6.2 E1.

#### One source of truth for the wire contract

Repo rule 3 (shared-tier dedup) already says cross-layer types live in `shared/`. L7 routes **already declare
Fastify JSON schemas** — so generate, don't hand-copy:

```
layer-7 .../schemas.js  ──(json-schema-to-typescript)──►  shared/types/api.d.ts
                                                            ├── used by L7 (validation)
                                                            └── used by L8 (dashboard)
```

A drifted field then fails `tsc`, not production.

#### Validate at the edge, trust inside

Types vanish at runtime. Adapters — and only adapters — validate:

```ts
// src/api/regimeApi.ts
const raw = await http.get('/api/v1/regime/latest');
const parsed = RegimeStateSchema.safeParse(raw.data);   // zod
if (!parsed.success) return { status: 'unreachable', reason: 'bad regime payload' };
```

A malformed payload must degrade to `unreachable`/`—`, never to `NaN` on a trading screen.

#### Migration (incremental, leaf-first — no big-bang)

1. Add `tsconfig.json` with `allowJs: true`, `strict: true`, `noUncheckedIndexedAccess: true`. Next 13 supports
   TS natively; `.js` and `.ts` coexist. Keep `jsconfig.json`'s `@/*` path alias.
2. Convert **leaves first** — `utils/format` → `atoms/` → `molecules/` → `organisms/` → `pages/`. A leaf has no
   dependents to break.
3. New code is **TS only**, starting with `src/ports`, `src/api`, and `shared/types`.
4. `.ts` for logic, `.tsx` only where JSX appears.
5. CI gate: `tsc --noEmit` + ESLint layering rule. Ratchet — never allow a new `.js` under `src/`.

---

## 3. The Option-Scalping Cockpit (`/scalp`) — all the data, one page

A scalp decision is made in seconds. Everything needed must be on one screen, and anything **missing or
stale must say so** rather than render a confident zero.

### 3.1 Data inventory — six groups (~40 fields)

**A · Permission — *may I trade at all?***
`tradeMode` · `killSwitch` · engine reachable · session clock (market open, **time→entry cutoff 15:00**,
**time→square-off 15:15**) · expiry-day flag · event-day flag · `RegimeState` (trend, strength, volatility,
phase, `tfAlignment{5m,15m,1h,D}`, `tradeableTiers`, confidence) · breadth (A/D ratio, %>EMA20, %>VWAP, avg
RSI, sentiment) · sector momentum (top-4 weighted) · **India VIX** + IV rank

**B · Instrument — *what am I trading?***
underlying selector (NIFTY | BANKNIFTY) · spot LTP, chg, chg% · day high/low · **session VWAP** · **ATR(5m)** ·
price chart (1m/5m candles + VWAP + EMA21 + volume + signal markers) · expiry selector + DTE

**C · Option chain — *what's actually tradeable?***
grid `CE | STRIKE | PE` for **ATM ± N**; per side: LTP, chg%, **bid/ask**, **spread (abs + % of premium)**,
**OI**, **ΔOI**, volume, **IV** · ATM row anchored · ITM/OTM shading · **liquidity gate chip**
(spread ≤ `maxSpreadPct` **and** OI ≥ `minOpenInterest`) · derived: **PCR**, **max pain**, total CE/PE OI,
**OI-buildup** per strike (long buildup / short buildup / unwinding / short covering)

**D · Engine intent — *what would it do right now?***
strike-preview (chosen strike, expiry, `nfoSymbol`, moneyness, **entry premium = ask**, computed **lots**,
**SL trigger**, target, ₹ risk) · **confluence checklist** (regime ✓ · breadth ✓ · momentum burst ✓ ·
not-extended ✓ · liquidity ✓ · VIX band ✓ · time window ✓) · live signal feed (`tier`, `strategyId`, `reasons[]`)

**E · Execution — *what is it doing?***
open positions (`nfoSymbol`, `lots × lotSize`, entry premium, LTP, **SL + resting order id**, trailing state,
**time-stop countdown**, ₹P&L / %) · orders & fills timeline (`ordertag`, latency stages) · daily risk envelope
(loss vs breaker, trades today, max concurrent) · **realised + unrealised P&L**

**F · Health — *can I trust the screen?***
per-stream staleness (ticks · chain · regime) · broker session (provider, **token expiry countdown**,
reconnects) · latency p50/p99 (tick → decision → order → fill)

> **Exactly one hero figure:** **Day P&L**. Spot LTP is a ticker, not a hero. (dataviz: one hero per view.)

### 3.2 Layout — CSS grid areas

**Desktop (≥1280px)**
```
┌──────────────────────────── SafetyBar (sticky) ─────────────────────────────┐
│ NIFTY ▾  25,113.40 ▲+0.42%   PAPER   ● regime fresh   15:00 in 2h14m  [KILL]│
├───────────────────────────────────┬─────────────────┬───────────────────────┤
│  chart (16:9)                     │  regime         │  hero: Day P&L        │
│  1m/5m · VWAP · EMA21 · vol       │  tfAlignment    │  risk meters          │
│  signal markers                   │  tradeableTiers │  positions            │
├───────────────────────────────────┤  breadth        ├───────────────────────┤
│  OPTION CHAIN  (ATM ± 7)          │  sectors        │  strike preview       │
│  CE … | STRIKE | … PE             │  VIX / IV rank  │  confluence checklist │
│  PCR · max pain · buildup         │                 │                       │
├───────────────────────────────────┴─────────────────┴───────────────────────┤
│  ▸ signal feed        ▸ orders & fills        ▸ latency      (collapsible)   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Mobile (<768px)** — one column, sticky safety bar, everything else stacked and collapsible:
```
[ SafetyBar: mode · KILL (44×44) · cutoff countdown ]   ← always visible
[ spot ticker + Day P&L hero ]
[ regime strip: 5m 15m 1h D  +  tiers ]
[ chart (aspect-video) ]
[ positions (cards, not a table) ]
[ ▸ option chain (ATM±2, CE/PE stacked) ]
[ ▸ breadth · sectors · VIX ]
[ ▸ signals · orders ]
```

### 3.3 Progressive disclosure (density, not deletion)
- Default **ATM ± 7** strikes; "expand" → ± 15.
- Tablet hides `volume` + `IV` columns; mobile keeps `LTP · spread · OI · ΔOI` only.
- A **density toggle** (comfortable / compact) persisted to `localStorage`.
- Collapsed panels still **poll/subscribe** so staleness stays honest when re-opened.

---

## 4. Routes — one per data domain

### 4.1 Page routes
```
/                       overview
/scalp                  ⭐ cockpit (defaults to NIFTY)
/scalp/[underlying]     NIFTY | BANKNIFTY
/chart/[symbol]         full-screen chart + indicators
/options/chain          full chain, all strikes, all expiries
/options/analytics      PCR · max pain · IV rank · OI buildup
/regime                 multi-TF regime detail
/breadth                breadth + sector heatmap
/signals                signal feed + filters (tier, strategy, outcome)
/trading                positions + risk            (exists)
/trading/orders         order & fill timeline
/trading/journal        closed trades, expectancy, slippage
/strategies             registry, enable/disable, params      [operator]
/strategies/[id]        params + live-vs-backtest expectancy  [operator]
/risk                   limits, sizing, cutoffs               [operator]
/backtest               run + compare                          [operator]
/promotions             human-gated promotion queue            [operator]
/brokers, /brokers/[id] provider registry (exists)             [operator]
/system                 service health                         (exists)
/system/latency         p50/p99 per execution stage
```

### 4.2 API routes (L7) — the data contracts the cockpit needs

| Route | Serves | Status |
|-------|--------|--------|
| `GET /api/v1/session/clock` | market state, entry cutoff, square-off, expiry/event flags | ❌ build |
| `GET /api/v1/market/index/:underlying/quote` | spot LTP, chg, high/low, VWAP, ATR | ❌ build |
| `GET /api/v1/market/index/:underlying/candles?tf=1m&limit=200` | chart series | ❌ build |
| `GET /api/v1/market/vix` | India VIX + IV rank | ❌ build |
| `GET /api/v1/options/expiries?underlying=` | expiry list + DTE | ❌ build |
| `GET /api/v1/options/chain?underlying=&expiry=&strikes=15` | chain rows (LTP, bid/ask, OI, ΔOI, IV, vol) | ❌ build |
| `GET /api/v1/options/analytics?underlying=&expiry=` | PCR, max pain, IV rank, per-strike buildup | ❌ build |
| `GET /api/v1/regime/latest` | RegimeState | ✅ **exists** |
| `GET /api/v1/breadth/latest` | breadth + sectors | ✅ **exists** |
| `GET /api/v1/signals?tier=&limit=` | signal feed | 🟡 exists, extend |
| `GET /api/v1/execution/state` | mode, killSwitch, positions, risk | ✅ **exists** |
| `POST /api/v1/execution/{kill,resume,square-off}` | controls | ✅ **exists** |
| `GET /api/v1/execution/strike-preview?underlying=&direction=` | **engine intent**: strike, premium, lots, SL | ❌ build |
| `GET /api/v1/execution/orders` · `/journal` | fills timeline, closed trades | ❌ build |
| `GET /api/v1/health/feeds` | per-stream staleness | ❌ build |
| `GET /api/v1/strategies` · `PATCH /:id` | strategy registry | ❌ build |
| `GET /api/v1/risk/config` · `PATCH` | risk limits | ❌ build |
| `GET /api/v1/broker-strategies` · `/providers/:p/status` | provider health | ✅ **exists** |

### 4.3 Realtime (socket.io rooms) — push, don't poll
`ticks:{underlying}` · `chain:{underlying}` · `regime` · `positions` · `execution-events` · `signals`

Both `executionSlice` and `regimeSlice` already expose `*Pushed` reducers for this. **Retire the 3s/5s polls.**

---

## 5. Charts & the option chain (dataviz rules apply)

- **Candles → `lightweight-charts`** (already a dependency; purpose-built). Update with `series.update(bar)`
  on tick — never `setData()` per tick. Wrap in a `ResizeObserver` + `aspect-[16/9]` container.
- **Equity / P&L / OI bars → `chart.js`.**
- **Never a dual-axis chart.** Price and volume are two panes, not two y-scales.
- **Colour by job:**
  - OI magnitude → **sequential**, one hue, light→dark.
  - **ΔOI → diverging**, two hues + a *neutral gray* midpoint (never a hue at zero).
  - CE/PE identity → categorical, fixed order, never cycled.
  - **Status colours are reserved** (`success|warning|error`) and always ship with an icon + label.
- **P&L colour is never the only cue** — always a sign and an arrow.
- `tabular-nums` in the chain grid and tables; **proportional** figures for the hero.
- Unknown value → `—`. Never `0`.
- The chain must scroll inside its **own** `overflow-x:auto` container; the page body never scrolls sideways.

---

## 6. Responsive strategy

| Breakpoint | Cockpit |
|---|---|
| `<640` | 1 col · chain as CE/PE stacked cards (ATM±2) · positions as cards |
| `640–1023` | 1 col + 2-col stat rows · chain drops `volume`,`IV` |
| `1024–1279` | 2 col (chart+chain / context) |
| `≥1280` | 3 col grid areas (as drawn above) |
| `≥1536` | widen chain to ATM±10, add latency panel inline |

**Non-negotiables**
- `SafetyBar` is **sticky at every size**. Kill switch ≥ **44×44px** touch target.
- `prefers-reduced-motion` → drop the `LIVE` badge pulse (keep icon + word).
- Every interactive control keyboard-reachable; `ConfirmDialog` traps focus and closes on `Esc` (already does).
- Charts and the chain get `min-height` so a collapsed panel can't produce a 0-height canvas.

---

## 7. State, performance & correctness

- **Selectors, not slices.** `createSelector` per widget; a tick must not re-render the regime card.
- **Option chain:** memoise rows by `strike`; virtualise past ~30 rows; apply socket **deltas**, not whole-chain
  replacement. Budget: ≤ 1 re-render per widget per tick, < 16 ms/frame during bursts.
- **Optimistic updates only for cosmetics** (theme, density, filters). Risk / strategy / provider mutations must
  await server confirmation — a UI that lies about a disabled strategy is dangerous.
- **Staleness everywhere:** every realtime slice keeps `lastUpdatedAt`; `useStaleness` drives amber ≥30 s, red ≥2 min.

---

## 8. Phased plan

```
P0  Foundations (blocking)
    D1  port ui/ primitives to semantic tokens -> light theme works
    D2  create atoms/molecules/organisms/templates + ESLint layering rule; move existing files
    D3  socket rooms; retire the 3s/5s polls
    TS  tsconfig (allowJs, strict) + shared/types + src/ports + src/api adapters
        convert leaves: utils/format -> atoms -> molecules
        CI gate: `tsc --noEmit` + layering lint; no new .js under src/

P1  Cockpit skeleton (no new backend)
    SafetyBar (sticky, mode+kill+session countdown) · CockpitTemplate grid
    Reuse: RegimeCard, PositionsTable, DailyRiskCard, StatTile  -> /scalp renders on existing endpoints

P2  Instrument + chart
    /api/v1/session/clock, /market/index/:u/quote, /candles  ->  PriceChart, spot ticker

P3  Option chain  ⭐ the big one
    /api/v1/options/{expiries,chain,analytics}  ->  OptionChainGrid, OptionAnalyticsPanel
    liquidity gate chip, OI-buildup classification, PCR/max-pain

P4  Engine intent
    /api/v1/execution/strike-preview  ->  StrikePreviewCard + ConfluenceChecklist
    (shows exactly why the engine would or would not take the trade)

P5  Realtime
    socket rooms; retire polling; per-stream staleness via /health/feeds

P6  Operator control
    /strategies, /risk, /trading/orders, /trading/journal, /system/latency
```

**Why this order:** P1 gives a usable cockpit on endpoints that already exist. The chain (P3) is the largest
build and depends on ingestion work that is still open (see `PROJECT_STATE.md` §4 — the option-chain pipeline is
unverified). P4 is the highest-value screen for a discretionary operator: it makes the engine's reasoning legible.

---

## 9. Decision Record

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-10 | Atomic Design, enforced by ESLint import rules | Folder names alone don't prevent decay |
| 2026-07-10 | One cockpit page `/scalp` carrying all six data groups | A scalp decision is made in seconds; context-switching loses the trade |
| 2026-07-10 | Exactly one hero figure (Day P&L); spot is a ticker | dataviz: one hero per view |
| 2026-07-10 | ΔOI uses a diverging scale with a neutral midpoint; OI uses sequential | Polarity vs magnitude are different jobs |
| 2026-07-10 | Socket push replaces the 3s/5s polls | Correctness (freshness) and cost |
| 2026-07-10 | Fix D1/D2/D3 before new features | A broken theme and an unenforced structure compound |
| 2026-07-10 | **TypeScript, incrementally, leaf-first** (`allowJs`, `strict`) | Big-bang TS migrations stall; leaves have no dependents to break |
| 2026-07-10 | **Ports & adapters in the UI**; organisms never fetch | Same pattern as `BrokerAdapter`. Swap a fake adapter to test the whole tree |
| 2026-07-10 | **Branded types** `Premium` vs spot; `Loaded<T>` union | Makes the audit's showstopper (spot compared to premium) and the "confident 0" bug *uncompilable* |
| 2026-07-10 | Generate `shared/types` from L7's Fastify JSON schemas | Repo rule 3 (shared-tier dedup); drift fails `tsc`, not production |
| 2026-07-10 | Validate payloads at the adapter edge (zod); trust inside | A bad payload degrades to `unreachable`/`—`, never `NaN` on a trading screen |

---

## 10. Hand-off

- **Next (frontend):** P0 defects, then `SafetyBar` + `CockpitTemplate` + `/scalp` on existing endpoints.
- **Next (backend, L7):** `session/clock`, `market/index/:u/quote|candles`, then the `options/*` trio.
- **Blocked:** the option chain UI is only as real as the ingestion pipeline — `PROJECT_STATE.md` lists the
  option-chain poller as **unverified**, and index spot/VIX ingestion as unconfirmed.
- **Do not** surface an "arm live" control anywhere until the validation roadmap passes.
- **Not pushed:** design only; no dashboard code changed by this document.
