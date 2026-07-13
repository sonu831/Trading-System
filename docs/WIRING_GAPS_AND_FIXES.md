# Architecture Wiring — Verified Gaps & Fix Plan

> **Purpose:** the dashboard (L8) must be the *trigger point*, the backend API (L7) the **single command
> plane**, and every layer must receive commands from / push state to it. This doc is a **code-verified audit**
> (2026-07-11, via graphify + direct file reads — not from status docs) of where that architecture is broken,
> and the exact fixes. It is written to be handed to another AI/engineer as a self-contained work order.
>
> **Trust warning:** several older docs overstate completion. Verified-stale claims are flagged in §7.
> Per repo rule 12 — verify by execution, never by document.

---

## 0. MASTER GAP REGISTER — every known gap, one table

> Single index of ALL open gaps across ALL documents. Each row: what's broken → where the drafted fix lives.
> Statuses: 🔴 OPEN (verified) · 🟠 VERIFY (needs confirmation) · 🟣 SAFETY (violates a non-negotiable rule) · ⚪ owner action.

| ID | Gap (one line) | Fix drafted in | Status |
|---|---|---|---|
| A | Two competing WS relays (`websocket.ts` + `SocketService.ts`), mismatched rooms | §3 FIX-A | 🔴 |
| B1 | `market_ticks` has NO Redis publisher (L1 only SETs `ltp:*`) | §3 FIX-B1 | 🔴 |
| B2 | Relay listens `signals`; L6 publishes `signals:trade` | §3 FIX-B2 | 🔴 |
| B3 | `option_chain_updates` has NO publisher | §3 FIX-B3 | 🔴 |
| B4 | Relay listens `notifications`; publishers use `notifications:execution/backfill/…` | §3 FIX-B4 | 🔴 |
| B5 | `execution:state` + `execution-events` have NO Redis publishers (Kafka only) | §3 FIX-B5 | 🔴 |
| B6 | L5 Go publisher of `market_view` channel unconfirmed | §3 FIX-B6 | 🟠 |
| C1 | `strategies-changed` published, consumed by NO ONE (L6 never hot-reloads) | §3 FIX-C | 🔴 |
| C2 | `risk-changed` published, consumed by NO ONE (L10 keeps stale limits) | §3 FIX-C | 🟣 |
| D1 | Frontend joins legacy room names; needs canonical set | §3 GAP-D | 🔴 |
| D2 | Pushed payloads lack timestamps → StaleBadge can't fire | §3 GAP-D | 🔴 |
| E1 | NO broker session refresh loop (promised in code header, absent) | §9 FIX-E1 | 🔴 |
| E2 | Session expiry is silent — no alert published | §9 FIX-E1 | 🔴 |
| E3 | Provider status = token exists, not token WORKS (false green) | §9 FIX-E2 | 🟠 |
| E4 | No single-flight lock on auth (double-login invalidates tokens) | §9 FIX-E3 | 🔴 |
| E5 | Kite daily interactive `request_token` flow missing end-to-end | §9 FIX-E4 | 🟠 |
| E6 | No server-time check before TOTP generation | §9 FIX-E5 | 🔴 |
| F1 | Dual schema authority: SQL migrations vs Prisma (drift/destruction risk) | §10 F1 | 🔴 |
| F2 | `index_membership` exists but population + consumption unverified | §10 F2 | 🟠 |
| F3 | Control-plane tables missing: alerts, strategy_registry, backtest_runs, prediction_log | §10 F3 | 🟠 |
| F4 | Writer INSERT idempotency (ON CONFLICT) unaudited | §10 F4 | 🟠 |
| F5 | No request_id / strategy_id / regime attribution columns on trades/order_log | §10 F5 | 🟠 |
| F6 | Continuous-aggregate ladder (5m/15m/1h) incomplete or unused by candles endpoint | §10 F6 | 🟠 |
| F7 | TimescaleDB background-job failures invisible | §10 F7 | 🔴 |
| F8 | Backup restore never drilled | §10 F8 | 🔴 |
| G1 | Frontend: legacy taxonomies remain (`features/`, `brokers/`, `trading/`, `regime/`, `analysis/`, root strays) beside atoms/molecules/organisms — restructure Phase 3 not done | this row + CHANGELOG Phase 1–2 precedent; register is the draft | 🔴 |
| G2 | No AppShell/grouped sidebar — Navbar is still 5 gradient buttons; ~20 routes can't scale. Reference design: `docs/design/mockups/cockpit-app.html` | `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md` §B/§C | 🔴 |
| G3 | Theme leaks: raw Tailwind palette classes (`from-sky-600`, `bg-gray-800`, `text-white`) in `Navbar.tsx`, `features/Dashboard/*`, `ScoreGauge` — don't flip with theme | codemod to semantic tokens + ESLint ban (§8 R9 pairs) | 🔴 |
| G4 | 3 component README examples import moved molecules from `@/components/ui` (Modal/Carousel) | one-line doc fixes | 🔴 cosmetic |
| G5 | `@ts-nocheck` epidemic across dashboard files nullifies TypeScript | §8 R9 (ratchet plan) | 🔴 |
| G6 | **Pages render DUMMY data as if live**: organisms carry mockup values as prop DEFAULTS (e.g. `AdvanceDeclineBar({ advancing = 38, declining = 12, adRatio = 3.17 })`) and pages render them with NO props/hooks — fabricated breadth/regime/etc. on a trading screen (rule-13, same class as P4) | §0.2 below (detailed fix prompt) | 🟣 |
| P0 | Predictive edge NOT proven — survivorship-safe daily breadth study never run | `PREDICTIVE_MODEL_BUILD_PROMPT.md` Phase 0 | 🔴 gate |
| P1 | `FeatureVector` (6 fields) vs `LSTMModel input_size=14` — contract mismatch | build prompt Phase 1 | 🔴 |
| P2 | No dataset/labels (no-lookahead, time-split, point-in-time constituents) | build prompt Phase 2 | 🔴 |
| P3 | Model untrained; no weights/scaler/manifest | build prompt Phase 3 | 🔴 |
| P4 | **L9 `/predict` returns hardcoded 0.65/0.70 dummy and L7 `/api/v1/predict` proxies it → UI can render a FABRICATED prediction (rule-13 violation, live today)** | build prompt Phase 4 (abstain-first); interim: make L9 stub return explicit `no-prediction` NOW | 🟣 |
| P5 | Prediction not consumed by L6 (correct until validated — keep gated) | build prompt Phase 5–6 | ⏸ by design |
| P6 | `contributions[]` (heavyweight index-points) missing from L5 `market_view` — `/internals` heavyweight panel + P features starve | `COCKPIT_BACKEND_PLAN.md` §4 #2 | 🔴 |
| H1 | MStock index tokens (NIFTY/BANKNIFTY/VIX) unverified in `vendor/nifty50_shared.json` | `MOMENTUM_TRADING_ARCHITECTURE.md` §6 | ⚪ owner |
| R1–R14 | Robustness/troubleshooting enhancements (correlation IDs … chaos drill) | §8 | 🔵 recommended |

## 0.2 GAP-G6 detail — frontend pages show dummy data (🟣 SAFETY) + fix prompt

**Mechanism (verified in code):** the new cockpit pages were ported from the visual mockup
(`docs/design/mockups/cockpit-app.html`) with the mockup's sample numbers left in as **default prop values**,
and the pages render the organisms **without wiring data**:

- `src/components/organisms/AdvanceDeclineBar.tsx` — `({ advancing = 38, declining = 12, aboveVwap = 74, aboveEma20 = 68, adRatio = 3.17, breadth = 'CONFIRMING' })`; `internals.tsx` renders `<AdvanceDeclineBar />` propless → **fake breadth renders as if live**. Same pattern expected in `SectorRotation`, `HeavyweightTable`, and sibling organisms (audit each).
- `predictions.tsx` is the GOOD counter-example: fetches `/api/v1/predict`, renders an explicit abstain state — but it calls `fetch` **in the page**, bypassing `src/api/index.ts` (the contract says adapters are the ONLY fetch point).
- The typed adapters for almost every screen ALREADY EXIST in `src/api/index.ts` (BreadthApi, RegimeApi, MarketViewApi, OrdersApi, AlertsApi, StrategiesApi, …) — the pages just don't use them.

**FIX PROMPT (paste-ready for any AI):**

> Audit EVERY file in `src/components/organisms/` and every page in `src/pages/` of
> `layer-8-presentation-notification/stock-analysis-portal`. For each organism: (1) **remove ALL non-null
> default values for market-data props** — defaults must be `undefined`/`null`, and the component must render
> `—` / a skeleton / `StaleBadge` when data is absent (rule 13 — never a confident fabricated number).
> (2) For each page: wire real data through the EXISTING typed adapters in `src/api/index.ts` (never `fetch`
> in a page or organism — move `predictions.tsx`'s inline fetch into a `PredictApi` adapter): breadth →
> `BreadthApi.getLatest`, regime → `RegimeApi.getLatest`, internals heavyweights → `MarketViewApi.get`
> (blocked on P6 `contributions[]` — render `—` until then), signals → `/signals`, orders → `OrdersApi.list`,
> alerts → `AlertsApi.list`, overview → `MarketViewApi` + `ExecutionApi.getState`; subscribe live updates via
> `useSocket` canonical rooms (Phase 1 wires). (3) Give every data surface the states: loading skeleton /
> fresh / STALE (timestamped) / empty / error — per the design laws in
> `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md` §A.
> **Acceptance:** with the backend STOPPED, no page shows the numbers 38/12/74/68/3.17 or any mockup value —
> only skeletons/`—`/STALE; with `make up`, pages show Redis-backed live values; killing L5 makes /internals
> go STALE within seconds. Add a regression test/lint rule banning literal-number defaults on market-data props.

## 0.1 EXECUTION ORDER — which document to work first

Work the documents in this order; each has its own prompt + acceptance criteria already drafted:

| # | Document (the "prompt") | Gaps it closes | Acceptance criteria live in | Why this order |
|---|---|---|---|---|
| 1 | **THIS DOC §4–§5** (steps 1–4: `REDIS_CHANNELS`, one relay, mismatches, publishers) | A, B1–B6, D1–D2 | §6 (verify-wiring gate) | Everything else is verified THROUGH live wires; nothing is observable until push works |
| 2 | **THIS DOC §9** (broker session monitor + liveness) | E1–E6 | §9 FIX-E + §6 item 4 | Sessions die daily; every market-hours test depends on connected brokers |
| 3 | **THIS DOC §3 GAP-C + §4 step 5** (command consumers) | C1, C2 | §6 item 3 | Dashboard "saves" must actually command layers — C2 is safety |
| 4 | **THIS DOC §10** (DB: F1 drift gate first, then F2/F3) | F1–F8 | §10 fix column | Schema safety before new tables land |
| 5 | **`docs/design/FULL_COCKPIT_DESIGN_PROMPT.md`** + restructure (AppShell, tokens codemod) | G1–G5 | design prompt §A laws + lint gates | UI scale-out on now-live data |
| 6 | **`docs/PREDICTIVE_MODEL_BUILD_PROMPT.md`** (Phase 0 study first; interim P4 abstain fix may jump the queue — it's 🟣) | P0–P6 | its Acceptance criteria section | Gated by proven edge; never before |
| 7 | §8 R1–R14 woven into each step (correlation IDs + heartbeats belong in steps 1–3) | R* | §8 | Continuous |

**Start point: this document, §4 step 1** (add `REDIS_CHANNELS` to `shared/constants.js`).
**Exception that may jump the queue: P4** — a one-file interim fix in L9 (return explicit abstain instead of 0.65) removes a live fabricated-value hazard.

---

## 1. Target architecture (the contract)

```
                       ┌─────────────  DASHBOARD (L8, Next.js)  ─────────────┐
                       │  src/api/index.ts = ONLY fetch point (typed adapters)│
                       │  useSocket.ts     = ONLY realtime point (socket.io)  │
                       └──────────────┬───────────────────▲──────────────────┘
                          commands    │ REST /api/v1/*     │ push (WS rooms)
                                      ▼                    │
                       ┌──────────  BACKEND API (L7, Fastify :4000)  ─────────┐
                       │  REST modules (market/signals/execution/regime/…)    │
                       │  WS relay: Redis pub/sub ──► socket.io rooms         │
                       │  Command fan-out: Redis pub/sub ──► L1/L6/L10        │
                       │  HTTP proxy ──► L10 :8095 (kill/resume/orders/state) │
                       └──┬────────────┬─────────────┬────────────┬───────────┘
                          ▼            ▼             ▼            ▼
                         L1           L6            L10          L9
                    (ingestion)   (signal/regime) (execution)  (AI/backtest)
        data flows stay on Kafka between layers; Redis = live KV + pub/sub notify
```

Rules that govern every fix below: Kafka-only between layers 1–6/10 (L7 is the sole UI gateway);
CQRS (Redis reads / TimescaleDB writes); every channel/topic/key name in `shared/constants.js`;
fail-closed — a dead dependency surfaces as an error/`—`, never a silent default.

---

## 2. What is VERIFIED WORKING today (do not rebuild)

### 2.1 REST plane — effectively complete ✅
Every endpoint the frontend adapter layer calls **exists in L7** (verified by matching
`src/api/index.ts` calls against route registrations):

| Frontend adapter (src/api/index.ts) | L7 route (file) | Status |
|---|---|---|
| MarketApi quote/candles | `system/routes.ts` L110/L161 (`/market/index/:u/quote`, `/candles`) | ✅ |
| OptionsApi expiries/chain/analytics | `system/routes.ts` L260/L276/L303 | ✅ |
| ExecutionApi state/kill/resume/square-off/strike-preview | `execution/routes.ts` L16–L47 | ✅ |
| OrdersApi list | `execution/routes.ts` L36 → L10 `/orders` | ✅ |
| RegimeApi / BreadthApi | `regime/routes.ts` L9/L18 | ✅ |
| SessionApi clock | `system/routes.ts` L83 | ✅ |
| StrategiesApi list/update | `system/routes.ts` L318/L337 | ✅ (but see GAP-C1) |
| RiskApi get/update | `system/routes.ts` L357/L372 | ✅ (but see GAP-C2) |
| AlertsApi list | `system/routes.ts` L484 | ✅ (but see GAP-B4) |
| BacktestApi run · `/predict` | `system/routes.ts` L417/L447 | ✅ |
| MarketViewApi / SystemApi status/feeds | `market/routes.ts` L12, `system/routes.ts` L15/L389 | ✅ |
| Broker provider registry (14 routes) | `broker/routes.ts` | ✅ |

### 2.2 Command plane — partially working
- **L7 → L10 commands:** `ExecutionService.ts` proxies HTTP to `http://execution:8095` with fail-loud
  timeouts (2.5s read / 15s write) and never invents values. **Correct pattern. Keep.**
- **`providers-changed`** (broker credential updates): published by `BrokerRepository.ts` L18, consumed by
  **both** `layer-1-ingestion/src/vendors/CredentialStore.ts` L118 and
  `layer-10-execution/src/credential-provider.ts` L163. **This is the reference pattern — replicate it.**
- **`system:commands`**: published by telegram-bot backfill service; consumed by `layer-1-ingestion/src/index.ts` L303. ✅
- **L6 internal**: regime engine publishes `market-regime` (engine.ts L275); L6 consumes `market_view` +
  `analysis:updates`. ✅

---

## 3. THE GAPS — realtime push plane (dashboard shows stale/never data)

### GAP-A (structural): TWO competing WS relays, different room names, same events
Both live in L7 and BOTH run:

| | `plugins/websocket.ts` (inline, newer) | `services/SocketService.ts` (older) |
|---|---|---|
| ticks | ch `market_ticks` → room **`ticks`** | ch `market_ticks` → room **`market-stream`** |
| signals | — | ch `signals` → room `signals-stream` |
| chain | ch `option_chain_updates` → room `chain` | — |
| regime | ch `market-regime` → room `regime` | ch `market-regime` → room `regime-stream` |
| positions | ch `execution:state` → room `positions` | — |
| execution | ch `execution-events` → room `execution` | ch `execution-events` → room `exec-stream` |
| alerts | ch `notifications` → room `alerts` | ch `notifications` → room `alerts-stream` |
| breadth | ch `sentiment_scores` → room `breadth` | ch `market_view` → room `market-stream` |

Consequences: duplicated Redis subscriptions; a client joining both room families gets double events;
`websocket.ts` reuses the **socket.io Redis-adapter's `subClient`** for app subscriptions (couples adapter
internals to app channels); and the frontend's event set (`tick/chain/regime/positions/execution/alert/breadth`
in `useSocket.ts`) matches the **newer** relay — `SocketService` rooms are mostly legacy.

**FIX-A:** ONE relay. Fold everything into `plugins/websocket.ts` (or a single rewritten `SocketService`),
with a **dedicated** Redis subscriber client (not the adapter's), one room set matching `useSocket.ts` events:
`ticks, chain, regime, positions, execution, alerts, breadth, signals`. Delete the losing implementation.
Add `REDIS_CHANNELS` to `shared/constants.js` as the single source of truth for channel names (rule 3/14) and
import it in BOTH the relay and every publisher below.

### GAP-B: publishers that don't exist (dead wires — the dashboard never receives these)
Verified by searching all layers for `publish(` call sites:

| # | Channel the relay subscribes | Actual publisher | Verdict |
|---|---|---|---|
| B1 | `market_ticks` (ticks) | **NONE** — L1 only `SET`s `ltp:*` keys; a SET never fires pub/sub | 🔴 DEAD — SafetyBar/chart get no live ticks over WS |
| B2 | `signals` (SocketService) | L6 publishes to **`signals:trade`** (orchestrator.ts L147, index.ts L180) | 🔴 name MISMATCH — live signal push never fires |
| B3 | `option_chain_updates` (chain) | **NONE** — L1 chain poller writes Kafka + KV only | 🔴 DEAD |
| B4 | `notifications` (alerts) | L10 publishes **`notifications:execution`** (index.ts L211); others publish `notifications:backfill`, `notifications:suggestions` | 🔴 MISMATCH — bare channel has no publisher |
| B5 | `execution:state` (positions) · `execution-events` (execution) | **NONE** in Redis pub/sub (`execution-events` is a Kafka topic only) | 🔴 DEAD — positions/kill state reach UI only by polling |
| B6 | `sentiment_scores` (breadth, websocket.ts) | **NONE** as a Redis channel (Kafka topic only). `market_view` channel (SocketService) IS consumed by L6 — L5 Go likely `Publish`es it (verify `.Publish(` in Go) | 🟡 one of two breadth wires live at best |
| B7 | `market-regime` (regime) | L6 `regime/engine.ts` L275 ✅ | 🟢 LIVE — the only fully-working push |

**FIX-B (per publisher, smallest change that lights the wire):**
1. **L1 ticks** — in the normalizer/vendor write path where `ltp:{symbol}` is SET, also
   `publish(REDIS_CHANNELS.TICKS, tick)` (throttle to ≤1/sec/symbol if needed).
2. **Signals** — standardize on `signals:trade` (already published): point the unified relay at it; delete the
   dead `signals` subscription.
3. **L1 option chain** — after each poll cycle, `publish(REDIS_CHANNELS.CHAIN, snapshot)` alongside the KV SET.
4. **Alerts** — standardize on ONE canonical channel (recommend `notifications`): switch L10/backfill/suggestion
   publishers to it with a `source` field, or have the relay `pSubscribe('notifications:*')`. Pick one; encode in
   `REDIS_CHANNELS`.
5. **L10 state/events** — after every fill/exit/kill/resume/square-off, publish the normalized state to
   `execution:state` and the event to `execution-events` (in addition to the Kafka journal). This is what makes
   the kill switch and positions feel instant on the dashboard.
6. **L5 breadth** — verify the Go aggregator `Publish`es `market_view` after each aggregation write; if it only
   SETs, add the Publish. Drop the dead `sentiment_scores` subscription.

### GAP-C: command fan-out with no consumers (dashboard "saves" that change nothing live)
| # | L7 publishes | Consumer | Verdict |
|---|---|---|---|
| C1 | `strategies-changed` (system/routes.ts L348, on PATCH /strategies/:id) | **NONE** — L6 subscribes only `market_view` + `analysis:updates` | 🔴 L6 never hot-reloads strategy enable/disable/params |
| C2 | `risk-changed` (system/routes.ts L380, on PATCH /risk/config) | **NONE** in L10 | 🔴 L10 keeps stale risk limits until restart — **safety-relevant** |

**FIX-C:** replicate the working `providers-changed` pattern:
- L6 `strategies/orchestrator.ts`: subscribe `strategies-changed` → re-read registry/params → apply without
  restart; log + emit an ack event.
- L10 `src/index.ts` (or risk manager): subscribe `risk-changed` → validate → hot-swap risk limits **only if
  stricter-or-equal while positions are open** (never loosen limits mid-position silently); log + ack.
- Both channel names into `REDIS_CHANNELS`.

### GAP-D: frontend room joins & staleness
- Audit every `subscribe(room)` call in pages/hooks to the canonical room set from FIX-A; remove legacy
  `market-stream`/`signals-stream` joins (older components e.g. MStockDashboard / useStockAnalysis).
- Every relayed payload must carry a timestamp; wire `useStaleness`/`StaleBadge` to it so a silently-dead wire
  **announces itself** on screen instead of freezing the last value (rule 13 — freshness is a safety property).

---

## 4. Ordered work plan (each step independently verifiable)

| Step | What | Where | Effort | Proves itself by |
|---|---|---|---|---|
| 1 | `REDIS_CHANNELS` in shared/ (+ constants.d.ts, Go mirror) | `shared/constants.js` | S | constants-parity test |
| 2 | Unify to ONE WS relay, dedicated sub client, canonical rooms; delete the other | L7 `plugins/websocket.ts`, remove `services/SocketService.ts` | M | wiring test (step 8) |
| 3 | Light dead publishers: L1 ticks + chain; L10 state/events/alerts; verify L5 breadth | L1 vendors/normalizer, L10 index/executors, L5 aggregator.go | M | wiring test |
| 4 | Fix mismatches: `signals:trade`, canonical alerts channel | relay + publishers | S | wiring test |
| 5 | Command consumers: `strategies-changed` in L6, `risk-changed` in L10 (hot-reload + ack) | L6 orchestrator, L10 risk manager | M | PATCH → observe reload log/ack |
| 6 | Frontend: canonical room joins; timestamps + StaleBadge on all pushed data | L8 `useSocket.ts`, pages, `cockpitSlice` | S–M | UI shows STALE when relay stopped |
| 7 | REST contract test: iterate every adapter endpoint in `src/api/index.ts` → assert 200 + `{success,data}` envelope | `scripts/` or L7 tests | S | CI gate |
| 8 | **End-to-end wiring test**: script publishes a fixture on every `REDIS_CHANNELS` entry → socket.io client asserts each event arrives in its room; fails on any dead wire | `scripts/verify-wiring.js` | M | THE gate — encode every bug above as an assertion |
| 9 | Docs: update stale docs (§7), CHANGELOG | docs/ | S | — |

Suggested sequence: 1 → 2 → 4 → 3 → 8 (get the gate green) → 5 → 6 → 7 → 9.

---

## 5. Contracts to add to `shared/constants.js` (draft)

```js
// Redis pub/sub channels — notify-only (payloads small; heavy data stays in Kafka/KV)
const REDIS_CHANNELS = {
  TICKS: 'market_ticks',              // L1 → relay (throttled)
  SIGNALS: 'signals:trade',           // L6 → relay        (matches existing publisher)
  REGIME: 'market-regime',            // L6 → relay        (already live)
  BREADTH: 'market_view',             // L5 → relay + L6   (verify Go publisher)
  OPTION_CHAIN: 'option_chain_updates', // L1 → relay
  EXECUTION_STATE: 'execution:state', // L10 → relay (positions snapshot)
  EXECUTION_EVENTS: 'execution-events', // L10 → relay (fills/rejects/kill)
  ALERTS: 'notifications',            // ALL → relay (payload carries `source`)
  // command fan-out (L7 → layers)
  PROVIDERS_CHANGED: 'providers-changed', // exists — reference pattern
  STRATEGIES_CHANGED: 'strategies-changed',
  RISK_CHANGED: 'risk-changed',
  SYSTEM_COMMANDS: 'system:commands',
};
```

WS rooms (relay → frontend): `ticks, chain, regime, positions, execution, alerts, breadth, signals` —
must equal the event names `useSocket.ts` dispatches to `cockpitSlice`.

---

## 6. Acceptance criteria (definition of "wired properly")

1. `node scripts/verify-wiring.js` green: every REDIS_CHANNELS entry has ≥1 real publisher and the socket client
   receives every event in its canonical room; zero duplicate deliveries.
2. Exactly ONE WS relay implementation exists in L7.
3. PATCH `/strategies/:id` visibly changes L6 behavior without restart; PATCH `/risk/config` visibly changes L10
   limits without restart (with the never-silently-loosen guard).
4. Killing the relay/publishers makes the dashboard show `STALE`/`—` — never a frozen "live" number.
5. REST contract test green for every adapter in `src/api/index.ts`.
6. All channel/room names come from `shared/constants.js`; grep finds no string-literal duplicates in layers.

---

## 7. Stale vs active documents (trust map)

| Doc | Verdict | Note |
|---|---|---|
| `docs/PROJECT_STATE.md` | ⛔ STALE (known) | rule 12 origin — claims verified only by document |
| `docs/COCKPIT_BACKEND_PLAN.md` §2–§4 | 🟡 PARTIALLY STALE | its 🔴 gaps #1,3,5,6,7,8 were BUILT later the same day (options/orders/backtest/strategies/alerts/risk routes exist); its realtime section (§5) is superseded by THIS doc |
| `docs/COCKPIT_INTEGRATION_AUDIT.md` | 🟢 ACTIVE | screen→API mapping from the integration pass |
| `docs/MOMENTUM_TRADING_ARCHITECTURE.md` | 🟢 ACTIVE | incl. §3.11 predictive-model corrections |
| `docs/RESTRUCTURE_PLAN.md` | 🟡 P0 done; P1–P3 open | per .ai memory |
| This doc | 🟢 ACTIVE | supersedes realtime/command wiring sections elsewhere |

---

## 8. Logged enhancements — robustness, zero-silent-failure, easy troubleshooting

Recommendations beyond the gap fixes, at the coding + architecture level. Each is independent; none blocks §4.

### 8.1 Zero-silent-failure (architecture)
- **R1 — Correlation IDs end-to-end.** Every dashboard command gets a `requestId` at L7, propagated through HTTP→L10→broker call→`execution-events`→UI toast. Pino child loggers carry it; one Loki query then shows a command's whole life. *This is the single biggest troubleshooting win.*
- **R2 — Heartbeats + freshness keys.** Every producer `SET`s `heartbeat:<layer>` with a TTL (e.g. 15s). `GET /api/v1/health/detailed` aggregates them; the System screen shows per-layer lag. A dead producer becomes visible in seconds, not "why is the chart frozen".
- **R3 — DLQ + bounded retry for every Kafka consumer.** Convention: `<topic>.dlq`; on repeated handler failure, park the message + alert instead of infinite crash-loop or silent skip.
- **R4 — Outbox pattern in L10.** Journal row and event publish in one transaction-ish flow; a sweeper republishes unsent rows. No lost fills/exits even if Redis/Kafka blips mid-trade.
- **R5 — Circuit breakers on L7→L10 and L7→L9 HTTP** (fail fast after N failures, half-open probes), with breaker state exposed on `/health/detailed` so "engine unreachable" is a state, not a timeout mystery.
- **R6 — Schema validation at every boundary.** Validate each consumed Kafka/Redis payload against a `shared/schemas/*` definition (ajv). Reject + DLQ on mismatch — a malformed producer must fail loudly at the boundary (rule 11), not deep in a strategy.
- **R7 — Generalized feed failover.** The dual-feed design (momentum doc §11.1: health-scored feeds, staleness cutover, divergence guard) should become the template for **every** external dependency, not just scalp ticks.

### 8.2 Coding-level
- **R8 — Typed config module per layer.** One `config.ts` that reads env ONCE at boot, validates against a schema, and crashes fast with a named error on anything missing — no scattered `process.env` reads (several found in route handlers).
- **R9 — Kill the `@ts-nocheck` epidemic.** Most dashboard files open with `@ts-nocheck`, which nullifies TypeScript entirely (the 14-vs-6 LSTM mismatch is what that costs). Ratchet: forbid new `@ts-nocheck` via ESLint now; burn down existing ones file-by-file. Also drop PropTypes where TS types exist (Navbar has both).
- **R10 — One logging idiom.** pino JSON + `requestId` child loggers in Node; zerolog JSON in Go; both shipped to Loki with a `layer` label (infra exists). Console.log stragglers (SocketService) migrate to the fastify logger.
- **R11 — Reconnect with jittered backoff everywhere.** Every Redis/Kafka/socket client: auto-reconnect, jittered backoff, and a log line + heartbeat gap when reconnecting — never a silently dead subscription (GAP-B is partly this disease).

### 8.3 Troubleshooting tooling
- **R12 — `scripts/verify-wiring.js --live`** (§4 step 8) doubles as the operator's probe: prints a ✓/✗ table per wire against the RUNNING stack. First command to run when "the dashboard looks dead".
- **R13 — Symptom-keyed runbooks.** `docs/runbooks/` keyed by what the operator SEES (`ENGINE OFFLINE`, `STALE badge`, `no ticks`, `kill switch stuck`) → which wire/heartbeat to check → which layer to restart. Ties UI symptoms to §5 channels.
- **R14 — Chaos drill target.** `make chaos` kills one random service; acceptance: the dashboard degrades to `STALE`/`—` everywhere within seconds and recovers alone. Proves rule 13 end-to-end and validates R2/R11.

## 9. Broker connection — audit & hardening (reported "not working as expected")

**What's verified good (keep):** `BrokerSessionService` is the single login point; strategies are per-broker
adapters (rule 14); TOTP secrets are strictly Base32-validated and **fail closed** with descriptive stages
(`login` / `totp_secret` / `totp_verify` / `needs_otp`) + `likelyCauses`; pending-OTP is parked in Redis (5-min
TTL); MStock supports both unattended TOTP (`totp_secret`) and direct 6-digit dashboard TOTP; tokens are cached
in Redis `broker:session:{provider}` with TTL to IST midnight and persisted encrypted to DB; L1/L10 consume via
`CredentialStore`/`CredentialProvider` + hot-reload on `providers-changed`.

**GAP-E: why connections still die in practice**

| # | Gap (verified unless marked) | Consequence |
|---|---|---|
| E1 | **No proactive refresh/re-auth loop exists.** The service header says "one refresh loop" — none is implemented in the file. Tokens expire at IST midnight and nothing re-authenticates. | Every morning the session is dead until a human opens the dashboard and re-enters a TOTP. Feeds/OMS start the day broken. |
| E2 | **Expiry is silent.** No alert is published when a token expires or auth fails (and the `notifications` wire is dead anyway — GAP-B4). | Operator discovers a dead broker only when the chart freezes or an order fails. |
| E3 | **Status = "token exists", not "token works"** (verify: `/providers/:provider/status` handler). A cached JWT can be revoked/invalid at the broker while the UI shows CONNECTED. | False-green status; failures surface at the worst moment (order placement). |
| E4 | **No single-flight lock on auth.** Two concurrent `test`/auth calls can double-login; some brokers invalidate the first token when a second login lands. | "It connected, then immediately disconnected" mysteries. |
| E5 | **Kite (Zerodha) needs a daily interactive `request_token` redirect** — unattended login is impossible by design (verify kite.ts completeness). No morning-connect flow exists in the UI. | Kite provider effectively unusable day-to-day. |
| E6 | **TOTP clock-skew is only a hint string.** No server-time check before generating the code. | Wrong-code failures with a misleading error. |

**FIX-E (ordered):**
1. **Session monitor loop (L7)** — a scheduler (e.g. every 5 min) per enabled provider: check Redis TTL remaining; at T−30 min: if `canAuthenticateUnattended` → re-auth automatically; else publish an actionable alert ("MStock session expires 23:59 IST — tap to re-enter TOTP") to the alerts channel + Telegram. On failure: alert with the strategy's staged error. *This closes E1+E2 and is the single biggest fix.*
2. **Liveness probe** — extend `/providers/:provider/status` to (rate-limited) call a cheap authenticated endpoint (profile/funds) and report `last_validated_at`; UI shows CONNECTED only on a recent successful probe, else `UNVERIFIED`/`EXPIRED` (never a false green — rule 13).
3. **Single-flight mutex per provider** around authenticate/test (in-process lock + Redis `SETNX` guard for multi-instance).
4. **Morning-connect ritual (UI)** — a pre-open checklist card (visible from 08:45 IST): each enabled provider's session state + one-tap re-auth (TOTP input for MStock, Kite redirect link for Zerodha). Pairs with E5.
5. **Server-time check before TOTP generation** (compare local vs broker/NTP; refuse + explain on >30s skew).
6. **Wire broker session events into the realtime plane** — publish `broker:session` state changes on the canonical alerts channel so SafetyBar/Brokers screen update live (depends on §3 FIX-B4).

## 10. Database & schema — audit + improvement plan (aligned to the above)

**Verified good (keep):** 7 ordered SQL migrations in `layer-3-storage/timescaledb/migrations/`;
execution hypertables exist (005: `trades`, `order_log`, `pnl_snapshots` + compression); continuous aggregates
exist (003, 006: 4h); retention policies set (007 extends `candles_1m` to 5 years); **`index_membership`
(point-in-time constituents) already exists in 007** — exactly what the predictive plan's survivorship fix
needs; Prisma (L7) carries control-plane tables (`broker_*`, `api_keys`, `backfill_jobs`) and mirrors the
hypertables as typed models.

**GAP-F: schema/data gaps**

| # | Gap | Fix |
|---|---|---|
| F1 | **Two schema authorities.** L3 raw SQL owns DDL; Prisma models mirror the same tables. One `prisma migrate dev` run by mistake could rewrite/destroy hypertable DDL. | Declare ownership in writing: **SQL migrations = only DDL authority; Prisma is introspect-only** (`prisma db pull`, never `migrate`). Add a CI drift gate: introspect scratch DB from migrations → diff against committed `schema.prisma`. |
| F2 | `index_membership` exists but is only useful **populated** — is historical NSE reconstitution data loaded, and do breadth/backtest actually JOIN it? (verify) | Loader script (`scripts/load-index-membership.js`) from NSE reconstitution history + make the breadth/backtest readers membership-aware (`as_of` join). Ties directly to `PREDICTIVE_MODEL_BUILD_PROMPT.md` Phase 0/2. |
| F3 | **Missing plan-aligned tables** (verify each before adding): `alerts` persistence (what does `GET /api/v1/alerts` read today?); `strategy_registry` (versioned params **per regime bucket** — where does PATCH /strategies persist?); `backtest_runs` (results + params + promotion state); `prediction_log` (model_version, features hash, prediction, later-observed outcome — required by the decay monitor §3.10). | One migration `008_control_plane.sql` adding the verified-missing ones; hypertable only where time-series (prediction_log, alerts). |
| F4 | **Writer idempotency unverified.** Rule 5 mandates `ON CONFLICT DO NOTHING` on inserts; migrations show few — but the rule applies to the *writer INSERTs* in L2/L3/L10 code. | Audit every INSERT site (graphify query per layer); add ON CONFLICT + a named regression test per writer. |
| F5 | **No attribution columns.** `trades`/`order_log` lack `request_id` (correlation, §8 R1), and per-trade `strategy_id`/`regime` snapshot (needed for per-regime expectancy, §3.10 optimizer). (verify exact columns) | `008` migration: add columns nullable-first; writers populate going forward; backfill best-effort. |
| F6 | **Aggregate ladder incomplete/unused?** 4h exists; confirm 5m/15m/1h continuous aggregates exist and that the candles endpoint reads aggregates instead of recomputing. | Complete the ladder with `timescaledb.materialized_only=false` (real-time aggregates); point `/market/index/:u/candles` at them. |
| F7 | **Background-job health invisible.** Compression/retention/aggregate refresh jobs can silently fail. | Expose `timescaledb_information.jobs` failures via `/health/detailed` + alert channel (pairs with §8 R2). |
| F8 | **Restore is untested.** `make backup`/`restore` exist; a backup that's never restored is a hope, not a backup. | Quarterly (or CI-nightly on scratch) restore drill target: `make restore-drill` restores latest dump to a temp container and runs row-count/spot-check asserts. Consider WAL archiving for PITR before live trading. |

## 11. Hand-off

- **For the implementing AI:** work §4 in order; treat §6 as the done-bar; every fix imports names from
  `shared/constants.js`; never leave both relays alive; encode each dead wire from §3 as an assertion in
  `scripts/verify-wiring.js` so regressions fail loudly.
- **Open verification (human or next agent, graphify-first):**
  - GAP-B6 — confirm the L5 Go aggregator `Publish`es `market_view`; B4 — decide the alerts channel convention (single channel vs `pSubscribe('notifications:*')`).
  - GAP-E1 — confirm no session refresh loop exists anywhere else (scheduler/cron); E3 — read the `/providers/:provider/status` handler (presence vs liveness); E5 — assess `kite.ts` completeness for the daily request_token flow.
  - GAP-F2 — is `index_membership` populated and joined by breadth/backtest? F3 — which of alerts/strategy_registry/backtest_runs/prediction_log tables already exist? F4 — audit writer INSERTs for ON CONFLICT; F5/F6 — confirm exact `trades`/`order_log` columns and the aggregate ladder.
- **Working rules for whoever picks this up:** graphify for every codebase query (rule 1); channel/key/topic names only from `shared/constants.js` (rule 3/14); never leave two WS relays alive; every fixed gap becomes a named assertion in `scripts/verify-wiring.js`; fail closed — no fabricated values (rules 11/13); see `.ai/skills/wiring-gaps.md`.
