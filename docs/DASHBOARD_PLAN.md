# Dashboard Plan — Operator Console + End-User Surface

> **Goal:** turn `stock-analysis-portal` into the **single control surface** for the platform — the Control Plane
> from [`TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md) §7 made real — and a richer, customer-facing product.
> **Status:** PLAN. Grounded in the code that exists today (audited 2026-07-09).

---

## 0. Where we actually are

**Stack (already chosen — build with it, don't fight it):**
Next.js 13 (pages router) · Tailwind · Redux Toolkit + react-redux · SWR · socket.io-client · axios ·
chart.js / react-chartjs-2 · **lightweight-charts** (TradingView-grade candles) · lucide-react

| Area | Today | Verdict |
|---|---|---|
| UI kit | `Badge, Button, Card, Carousel, Input, Modal, Table, ThemeToggle` | ✅ Solid base — reuse, don't reinvent |
| Layout | `AppLayout, Navbar, Footer` | ✅ |
| Brokers | `BrokerList/{BrokerCard,BrokerStatusBadge}`, `BrokerDetail/{BrokerConfig,CredentialField,CredentialForm,MStockAuthFlow}`, `AddBrokerModal` | ✅ **Provider registry UI is well underway** |
| Pages | `index`, `[symbol]`, `analysis/[symbol]`, `brokers/`, `brokers/[id]`, `backfill`, `swarm`, `system` | 🟡 |
| Store | `brokerSlice, marketSlice, signalsSlice, systemSlice` | 🟡 |
| **Trading engine (L10)** | **nothing** — no positions, P&L, orders, kill switch, trade-mode | 🔴 **The big gap** |
| **Regime / strategies / risk** | **nothing** — L5 regime + L6 strategy framework are invisible | 🔴 |

**The headline:** you can configure *brokers* but you cannot see or control *the thing that trades*. After the
L10 audit (see [`PROJECT_STATE.md`](../PROJECT_STATE.md) §2a), that is the most important gap to close.

---

## 1. Two personas, one app

Don't build one undifferentiated dashboard. Role-gate a single Next.js app.

| | **Operator Console** (you) | **End-User Surface** (customer-facing) |
|---|---|---|
| Purpose | Run and control the system | Consume insights & performance |
| Can | Enable/disable providers & strategies, edit risk, **kill switch**, arm modes, run backtests | View signals, charts, breadth, performance, their own alerts |
| Cannot | — | Change any config; see credentials; place orders |
| Route guard | `role=operator` | `role=viewer` (default) |

Everything mutating lives behind `role=operator`. The end-user surface is **strictly read-only** — a safety
property, not just a UX one.

---

## 2. Information Architecture (routes)

```
/                        Overview        — regime + breadth + P&L + open positions + kill switch
/trading                 Execution       — positions, orders, fills, exits, trade-mode  [operator]
/trading/positions       Position detail — per-position: entry, SL, trail, live P&L
/trading/journal         Trade journal   — history, filters, expectancy, slippage
/regime                  Market regime   — multi-TF trend/vol/phase/alignment + breadth + sectors
/strategies              Strategy mgmt   — enable/disable/tune, regime affinity, shadow compare  [operator]
/risk                    Risk config     — limits, sizing, cutoffs, circuit breaker state         [operator]
/backtest                Backtest/optimize — run, compare, human-gated promotion                 [operator]
/options                 Option chain    — OI, IV, PCR, max pain, OI buildup
/brokers                 Providers       — registry: add/edit/enable/disable/prioritize (EXISTS) [operator]
/brokers/[id]            Provider detail — credentials, session status, test/login  (EXISTS)     [operator]
/analysis/[symbol]       Symbol analysis — indicators, chart (EXISTS)
/system                  Health          — service status, latency, Kafka lag (EXISTS)
```

---

## 3. The safety-critical UI rules

A trading dashboard is not a CRUD app. These are non-negotiable.

| # | Rule | Implementation |
|---|------|----------------|
| U1 | **Kill switch is always one click away** | Persistent button in `Navbar`, visible on every route. Red. Confirms once, then fires `POST /execution/kill`. |
| U2 | **Trade mode is always visible and unmistakable** | Global badge: `PAPER` (grey) · `SHADOW` (amber) · **`LIVE` (red, pulsing)**. Never let someone wonder if it's real. |
| U3 | **Arming live requires deliberate friction** | Type-to-confirm modal (`type LIVE to arm`) + shows the `LIVE_TRADING_ARMED` precondition + the last validation-checkpoint result. |
| U4 | **Stale data must announce itself** | Every live panel shows `updated Xs ago`; > 30s → amber; > 2min → red "STALE — do not trade on this". |
| U5 | **Secrets are never rendered** | `CredentialField` shows `•••• configured`, last-tested time. API must never return secrets. |
| U6 | **Destructive actions confirm** | Square-off all, disable a provider mid-session, promote a strategy to live. |
| U7 | **Money is unambiguous** | Always show ₹ with sign and colour; show **lots × lotSize** so quantity is never mistaken for premium. |
| U8 | **Never invent numbers** | If P&L/regime is unavailable, render `—`, not `0`. (The pre-audit engine reported ₹0 P&L on every trade — a UI that showed `0` confidently would have hidden the bug.) |

---

## 4. What to build, in order

### Phase 1 — Make the engine visible (highest value; unblocks paper re-run)

**`executionSlice`** + `/trading` + Overview widgets. L10 already exposes what we need:
`GET /health`, `GET /state` (positions + risk), `GET /metrics`, `POST /kill`, `POST /resume`,
plus Redis key `execution:state` (published every 5s by the reconcile loop).

| Component | Shows |
|---|---|
| `KillSwitchButton` (Navbar) | live kill state; one-click halt (U1) |
| `TradeModeBadge` (Navbar) | paper/shadow/live (U2) |
| `PositionsTable` | symbol, strike, expiry, CE/PE, lots × lotSize, entry premium, LTP, **SL & trailing stop**, live ₹P&L, age vs time-stop |
| `DailyRiskCard` | trades today / max, daily P&L, **distance to daily-loss breaker** (progress bar) |
| `OrdersTimeline` | entry → SL placed → trail → exit, with `ordertag` (from `execution-events`) |
| `PnLSparkline` | intraday realised + unrealised |

> Show the **stop-loss and the resting SL order id** on every position. The audit found positions that had no
> broker-side stop at all; the UI should make that impossible to miss (`SL: none` → red).

### Phase 2 — Regime + breadth (the "market moment")

`regimeSlice` ← `market-regime` (Redis `market-regime:latest`, socket push).

- `RegimeCard`: trend · strength · volatility · phase, plus a **timeframe-alignment strip** (5m/15m/1h/D as four
  chips, green/red/grey) — one glance tells you whether positional trades are allowed (`tradeableTiers`).
- `BreadthPanel`: advance/decline, % above EMA20/50/200, avg RSI (from L5 `market_view`).
- `SectorHeatmap`: sector momentum (`STRONG_UP … STRONG_DOWN`).
- `TradeableTiersIndicator`: T1/T2/T3 chips — which tiers the regime currently permits.

### Phase 3 — Strategy + risk control (the adaptive framework, exposed)

- `/strategies`: table of plugins → `enabled` toggle, `tier`, **`regimeAffinity`** chips, params (editable),
  live-vs-backtest expectancy, and a **shadow comparison** view (which plugin *would* have done better).
- `/risk`: `maxConcurrentPositions`, `maxTradesPerDay`, `maxDailyLoss`, `capitalAtRisk`, `maxLots`,
  `entryCutoff`, `squareOffTime`. Edits go to the config store; L10 reads live values.
- Both require new L7 endpoints (below) — today these are env/config-file only.

### Phase 4 — Backtest, optimizer, promotion

- Launch a backtest/optimization job; stream progress; compare parameter sets **per regime bucket**.
- **Human-gated promotion**: a diff view (current vs proposed params) + explicit approve. This is the
  `promotion-manager.js` workflow given a face. Never auto-promote.

### Phase 5 — Options analytics + end-user surface

- `/options`: option chain grid (strike × CE/PE), OI + **OI change**, IV, volume; derived **PCR**, **max pain**,
  **OI-buildup** classification (long/short buildup, unwinding, short-covering).
- End-user surface: read-only signals feed, performance/equity curve, per-symbol analysis, alert preferences.

---

## 5. API contract needed from L7 (Core API)

The dashboard is only as good as what the API exposes. Today most of these don't exist.

```
# execution (proxy L10)
GET    /api/execution/state          -> { mode, positions[], risk{}, killSwitch }
POST   /api/execution/kill           -> halt new entries (+ square-off)
POST   /api/execution/resume
POST   /api/execution/square-off     -> flatten all (confirm)
GET    /api/execution/journal        -> trades (filters: date, strategy, tier, reason)

# regime + breadth
GET    /api/regime/latest            -> RegimeState
GET    /api/breadth/latest           -> BreadthMetrics + SectorMetrics

# strategies  [operator]
GET    /api/strategies               -> [{id, enabled, tier, regimeAffinity, params, stats}]
PATCH  /api/strategies/:id           -> enable/disable, update params

# risk  [operator]
GET    /api/risk/config  |  PATCH /api/risk/config

# providers  [operator]  (registry — see SIMPLE_ROBUST_ARCHITECTURE_PLAN §4.7)
GET    /api/providers | POST /api/providers | PATCH /api/providers/:id
POST   /api/providers/:id/{enable|disable|test|login|logout}

# backtest  [operator]
POST   /api/backtest/run | GET /api/backtest/:jobId
GET    /api/promotions | POST /api/promotions/:id/{approve|reject}
```

**Realtime:** socket.io rooms — `regime`, `positions`, `signals`, `execution-events`. Use **socket.io for push**
(positions, regime, fills) and **SWR for pull** (config, journal, backtests). Don't poll what can be pushed.

---

## 6. State & data-fetching design

```
store/slices/
  brokerSlice.js     (exists)   marketSlice.js  (exists)
  signalsSlice.js    (exists)   systemSlice.js  (exists)
  executionSlice.js  (NEW)  positions, orders, risk state, mode, killSwitch
  regimeSlice.js     (NEW)  RegimeState + breadth + sectors + lastUpdated
  strategySlice.js   (NEW)  plugin registry + params + stats
  riskConfigSlice.js (NEW)  editable risk config (optimistic update + rollback on 4xx)
```

- Every realtime slice stores `lastUpdatedAt`; a shared `useStaleness(ts)` hook drives rule **U4**.
- Optimistic updates **only** for non-financial config (theme, filters). Risk/strategy/provider changes must
  await server confirmation — a UI that lies about whether a strategy is disabled is dangerous.

---

## 7. Design system notes

- Keep Tailwind + the existing `ui/` kit. Add: `StatTile`, `Sparkline`, `StatusDot`, `ConfirmDialog`,
  `StaleBadge`, `RegimeChip`, `Heatmap`.
- **Charts:** `lightweight-charts` for price/candles (it's already a dependency and is purpose-built);
  `chart.js` for P&L/equity/bars. Before writing any chart code, follow the repo's dataviz guidance — one
  consistent palette, colour-blind safe, works in both themes (`ThemeToggle` exists).
- **Semantics over decoration:** green/red must encode P&L direction only; never use red for a neutral "info"
  state on a trading screen.
- Mobile: the operator must be able to hit **kill** from a phone. `/` and the kill switch are the two views that
  must be fully responsive.

---

## 8. Sequencing (why this order)

1. **Phase 1 first** — you're about to re-run paper mode from scratch (all prior results are void). Without a
   positions/P&L/journal view you cannot tell whether the fixed engine behaves correctly.
2. **Phase 2** — regime visibility is what lets you trust (or veto) positional trades.
3. **Phase 3** — only once you can *see* the engine should you be able to *tune* it from the UI.
4. **Phase 4/5** — optimization and customer-facing polish come after the core loop is observable and safe.

---

## 9. Status — Phase 1 BUILT (2026-07-09)

**Frontend** (`stock-analysis-portal`) — verified with `npx next build` (the `/trading` route compiles):

- `store/slices/executionSlice.js`, `store/slices/regimeSlice.js`; `hooks/useStaleness.js`; trading formatters in `utils/format.js`
- `components/trading/`: `StatTile`, `RiskMeter`, `DailyRiskCard`, `PositionsTable`, `TradeModeBadge`,
  `KillSwitchButton`, `ConfirmDialog`, `StaleBadge`
- `components/regime/RegimeCard.jsx`; page `pages/trading.js`
- **Navbar** now carries `TradeModeBadge` + `KillSwitchButton` on every route (rules U1/U2)

**Backend (L7)** — verified with `node tests/verify-execution-proxy.js` (13 assertions):

- `modules/execution/` → `GET /api/v1/execution/state`, `POST /api/v1/execution/{kill,resume,square-off}` (proxy onto L10)
- `modules/regime/` → `GET /api/v1/regime/latest`, `GET /api/v1/breadth/latest` (Redis read path, CQRS)
- Registered in `container.js` + `index.js`; `EXECUTION_URL` added to `backend-api` in `docker-compose.app.yml`

**Layer 10** gained `POST /square-off`; `/kill` now flattens the book (it previously only set the flag);
`/state` now returns `killSwitch` + `timestamp`.

> ⚠️ **The execution port is 8095, not 8090.** `Dockerfile` EXPOSE/HEALTHCHECK, compose `PORT`,
> `config/default.js`, and the L7 `EXECUTION_URL` default must all agree. A mismatch silently renders
> "ENGINE OFFLINE" with no other symptom.

---

## 10. Hand-off

- **Next (frontend):** Phase 2 — `BreadthPanel`, `SectorHeatmap`, `/regime` page. Data is already served by
  `GET /api/v1/breadth/latest`.
- **Realtime:** the page polls every 3s (Navbar every 5s). Swap to socket.io rooms (`positions`, `regime`,
  `execution-events`) when the socket plugin exposes them — both slices already have `*Pushed` reducers for it.
- **Blocked on control plane:** `/strategies`, `/risk`, and provider enable/disable need the config store +
  registry from [`SIMPLE_ROBUST_ARCHITECTURE_PLAN.md`](SIMPLE_ROBUST_ARCHITECTURE_PLAN.md) §4.7.
- **Do not** surface an "arm live" control until the validation roadmap passes (`PROJECT_STATE.md` §5).
- **Not pushed:** no git operations performed.
