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
| E1 | NO broker session refresh loop (promised in code header, absent) | §9 FIX-E1 | ✅ |
| E2 | Session expiry is silent — no alert published | §9 FIX-E1 | ✅ |
| E3 | Provider status = token exists, not token WORKS (false green) | §9 FIX-E2 | ✅ |
| E4 | No single-flight lock on auth (double-login invalidates tokens) | §9 FIX-E3 | ✅ |
| E5 | Kite daily interactive `request_token` flow missing end-to-end | §9 FIX-E4 | 🟠 |
| E6 | No server-time check before TOTP generation | §9 FIX-E5 | ✅ |
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
| **I1** | **Session token NEVER reaches a running vendor after dashboard login → MStock streams nothing until L1 restarts** | §11 FIX-I1 | ✅ |
| **I2** | **Silent fallback feeds MStock the WRONG BROKER'S instrument tokens (Kite) → WS connects, subscribes, streams zero ticks** | §11 FIX-I2 | 🔴 |
| I3 | Subscription list is MStock-token-specific but broadcast to ALL vendors (Kite/FlatTrade get MStock tokens) | §11 FIX-I3 | 🔴 |
| I4 | MStock SDK version drift: installed `subscribe(tokens[])` vs documented `subscribe(exchange, tokens[], mode)`; no feed MODE selected | §11 FIX-I4 | 🟠 |
| I5 | `maxReconnectionAttempts: 0` is falsy → SDK silently uses 5 | §11 FIX-I5 | 🟡 |
| I6 | `mstock.js` monkey-patches global `console.error`/`console.log` at import (process-wide) | §11 FIX-I6 | 🟡 |
| ~~J1~~ | ~~AUTH BYPASS: auth ran only when an `x-api-key` header was present ⇒ omitting it served EVERY route unauthenticated (incl. decrypted broker credentials, kill switch)~~ → **FIXED 2026-07-13**: default-deny (only `PUBLIC_API_ROUTES` open); `INTERNAL_API_KEY` service key for dashboard-proxy/L1/L10; L7 refuses to boot without it; L7 port re-bound to `127.0.0.1`. Guarded by `tests/verify-api-auth.js` (20 asserts) | §13 FIX-J1 | ✅ |
| J2 | No TLS: API + dashboard served over plain HTTP; broker redirect URIs and credentials would transit in clear | §13 FIX-J2 | 🟣 |
| J3 | No broker OAuth callback route exists (`/redirect`, `/callback`, `/auth/*` — none registered). FlatTrade/Kite require a registered redirect URI; current flow is manual paste of `request_code` | §13 FIX-J3 (= E5) | 🔴 |
| ~~J4~~ | ~~CORS `origin: '*'` on REST + socket.io — any website could drive the trading API from the operator's browser~~ → **FIXED 2026-07-13**: allow-list from `DASHBOARD_ORIGINS`. Guarded by `J4:` assertions | §13 FIX-J4 | ✅ |
| ~~K1~~ | ~~FlatTrade L7 strategy calls the WRONG base URL `/PiConnectTP`~~ → **FIXED 2026-07-13**: all 3 URLs now import from `shared/constants.js` (fail-closed if unresolvable). Guarded by `K1:` assertions in `tests/verify-broker-auth.js` | §14 FIX-K1 | ✅ |
| ~~K2~~ | ~~FlatTrade session TTL expired EVERY HOUR, forcing hourly browser re-login~~ → **FIXED 2026-07-13**: TTL now runs to the broker's 06:00 IST token reset (`secondsUntilNextISTHour(6, now)`). Guarded by `K2:` assertions | §14 FIX-K2 | ✅ |
| K3 | No **Postback/webhook** endpoint exists — FlatTrade registration requires a Postback URL for order updates; without it, fills/rejects are never pushed to us | §14 FIX-K3 | 🔴 |
| K4 | FlatTrade token exchange **only succeeds from the registered static Primary IP** — L7's egress IP must equal it (undocumented in deployment) | §14 FIX-K4 | 🟠 |
| K5 | `docs/BROKER_LOGIN_FLOWS.md` FlatTrade section is **stale/wrong** (documents `/PiConnectTP` and "no separate login step — API key is the credential"; the real flow is 3-legged browser auth) | §14 FIX-K5 | 🟡 |
| **L1** | **🔥 BACKFILL IS DEAD: `scripts/backfill-runner.js` is TypeScript source with a `.js` extension → `SyntaxError: Unexpected token '?'` on every run.** Verified by executing it in the live container. Every dashboard backfill dies at step 1 | `BACKFILL_SYSTEM_PLAN.md` §1 | 🔥 |
| **L2** | **Fabricated success: L1 returns `{success:true}` BEFORE the child process parses; the crash is `.catch`-logged and dropped.** Dashboard shows green for a job that never ran (rule 13) | plan §5 step 2 | 🟣 |
| L3 | `batch_streaming.js` fails `node --check` too (same TS-in-`.js` class); `ts-node` is installed in L1 (rule 15 forbids it); `runScriptWithIPC` uses bare `fork()` which cannot run TS | plan §5 step 1 | 🔴 |
| L4 | `no-ts-js-twins` gate has a blind spot: it only catches a file existing as BOTH `.ts` and `.js` — not TS *content* in a `.js` file | plan §5 step 3 | 🔴 |
| L5 | Two competing trigger paths: L7→L1 **direct HTTP** (`ingestion:9101`, violates rule 4) vs Redis `system:commands` (Telegram) | plan §5 step 4 | 🔴 |
| L6 | No range fan-out: cannot backfill **NIFTY + BANKNIFTY + 50 constituents** for a date range (owner's core requirement); `isBackfilling` boolean = no queue/resume | plan §5 step 7 | 🔴 |
| L7 | `data_availability` (the coverage map table) is **never populated** — because no backfill has ever succeeded | plan §5 step 9 | 🔴 |
| L8 | Candle inserts lack an asserted `ON CONFLICT DO NOTHING` (rule 5) → re-running a range may duplicate bars | plan §5 step 8 | 🟠 |
| **D0** | **🔥 UNVERIFIED: how far back MStock/FlatTrade actually serve 1-MINUTE candles.** Brokers commonly cap intraday history (~60d). A "3-year 1m backfill" may be impossible from the source — 19,500 requests returning nothing, reported as COMPLETE. **PROBE before building** | `DATA_PLATFORM_PLAN.md` §1 | 🔥 |
| D1 | No work-unit model — a 19,500-request job that dies at 18,000 restarts from zero; no resume/queue/per-symbol progress | plan §5.2 | 🔴 |
| D2 | `data_availability` never populated → cannot answer "from which timestamp do we have data" (the owner's core purpose) | plan §5.3 | 🔴 |
| D3 | Progress is one global % — Swarm page cannot show per-symbol chunks/rows | plan §5.2 | 🔴 |
| D4 | No rate limiter — 19,500 requests will trip broker throttles | plan §5.4 | 🔴 |
| D5 | Candle insert lacks an asserted `ON CONFLICT DO NOTHING` (rule 5) | plan §6 | 🟠 |
| D6 | Executor role not capability-asserted: **mstock has `restingStop:false`** so it must NEVER be the OMS (rule 11); FlatTrade is the only valid executor | plan §2 | 🔴 |
| D7 | No after-hours window — a 20-min swarm would contend with the live tick feed | plan §5.5 | 🟠 |
| D8 | `BROKER_BASE_URLS.FLATTRADE_WS` unverified — cannot be relied on as the failover tick feed | plan §5.6 | 🟠 |
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
| E1 | ✅ **FIXED 2026-07-13:** Session monitor runs every 60s, adapts threshold to actual token lifespan (not policy TTL), handles cold-start (no token → re-auth), handles expired tokens (key outlives token so monitor can detect), and uses the auth lock to prevent race conditions with manual dashboard login. | — |
| E2 | ✅ **FIXED 2026-07-13:** Monitor publishes alerts on auth failure via `REDIS_CHANNELS.ALERTS` (`notifications`), and logs all state transitions with timestamps. | — |
| E3 | ✅ **FIXED 2026-07-13:** `/providers/:provider/status` now runs `probeLiveness()` (MStock: `/profile`, FlatTrade: `UserDetails`) before returning CONNECTED. Returns EXPIRED/DISCONNECTED on failed probe. | — |
| E4 | ✅ **FIXED 2026-07-13:** `withAuthLock()` — in-process Map + Redis `broker:authlock:{provider}` `SETNX` with 30s TTL. Monitor and dashboard Test Connection both use it. | — |
| E5 | **Kite (Zerodha) needs a daily interactive `request_token` redirect** — unattended login is impossible by design (verify kite.ts completeness). No morning-connect flow exists in the UI. | Kite provider effectively unusable day-to-day. |
| E6 | ✅ **FIXED 2026-07-13:** `mstock.ts authenticate()` now calls `GET https://api.mstock.trade/api/server-time` before TOTP generation. Refuses + explains on >30s skew. | — |

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

## 11. GAP-I — Ingestion (L1) ↔ Broker session: why MStock fetches NO DATA

**Symptom:** MStock authenticates on the dashboard, the WebSocket connects, but **zero ticks arrive**.
**Diagnosis (verified in code 2026-07-11, graphify-first):** three *independent* blockers, each sufficient on its own.

### I1 🟣 — The session token never reaches a running vendor (login on dashboard ⇒ L1 still deaf)

Evidence chain:

1. `layer-7-core-interface/api/src/modules/broker/BrokerService.ts` L80–85 — `saveSessionToken()` writes the
   token to Redis (`broker:session:{provider}` = `{token, expiresAt}`) and the DB, **and publishes NOTHING.**
   (The only broker publish in the repo is `BrokerRepository.publishConfigChange()` → `providers-changed`,
   which fires on *config* changes, not on a new session token.)
2. `layer-1-ingestion/src/vendors/CredentialStore.ts` L55–58 — `refreshProviders()` calls `loadTokens()` **only
   if `detectChanges()` is true**, and `detectChanges()` compares the *provider list* (`provider:enabled` set).
   A brand-new token with an unchanged provider list ⇒ **`loadTokens()` is skipped**.
3. `layer-1-ingestion/src/vendors/manager.ts` L45–46 — the token is read **once, at vendor construction**
   (`credentialStore.getToken(name)` → `sessionToken`). **Nothing ever calls `vendor.setAccessToken()`** —
   `MStockVendor.setAccessToken()` (mstock.js L61) is **dead code**, and the comment at mstock.js L189
   ("the CredentialStore will eventually push a new one via setAccessToken()") is **false**.

⇒ If L1 boots before the user authenticates (the normal case), `MStockVendor` is constructed with **no token**,
`connect()` logs *"no session token — waiting for dashboard auth"* and returns. The user then logs in… and L1 is
never told. It stays deaf **until L1 restarts**.

**FIX-I1:** (a) L7 `saveSessionToken()` publishes `REDIS_CHANNELS.BROKER_SESSION_CHANGED` (add to `shared/constants.js`)
with `{provider, expiresAt}`. (b) L1 `CredentialStore` subscribes to it → `loadTokens()` **unconditionally**
(and decouple `loadTokens()` from `detectChanges()` — a token change is not a provider change). (c) On token
arrival, `VendorManager` calls `vendor.setAccessToken(token)` and re-`connect()`s the vendor (or recreates it).
(d) Regression test: with L1 running and no token, write a session token → assert the vendor connects within N seconds.

### I2 🔴 — Silent fallback feeds MStock the WRONG BROKER'S instrument tokens

`layer-1-ingestion/src/index.ts` L248–264:

```js
const mapPath = path.resolve(__dirname, '../vendor/nifty50_shared.json');   // L1/vendor/...
const masterMap = require(mapPath);
subscriptionList = masterMap.filter(i => i.tokens?.mstock).map(i => `NSE:${i.tokens.mstock}`);
} catch (e) {
  logger.warn(`⚠️ Failed to load Global Map: ${e.message}. Falling back to config/symbols.json (Legacy)`);
  subscriptionList = symbols.nifty50.map(s => `NSE:${s.token}`);  // ← "might be Kite tokens!" (its own comment)
}
```

- `layer-1-ingestion/vendor` **does not exist** (the symlink is deleted — it is in the staged deletions).
  The real map is at repo-root `vendor/nifty50_shared.json`.
- So the `require` throws → the catch fires → `config/symbols.json` is used, which holds **KITE** tokens.

| Symbol | `config/symbols.json` (used) | `vendor/nifty50_shared.json` (correct) | MStock SDK sample |
|---|---|---|---|
| RELIANCE | **256265** ← Kite | `kite: 256265`, **`mstock: 2885`** | `subscribe("NSE", ["2885"])` ✅ |

MStock's WS accepts a subscribe for unknown tokens and simply **streams nothing** ⇒ exactly the reported symptom.
Docker masks this (`docker-compose.app.yml` mounts `../../vendor:/app/vendor:ro`, so `/app/vendor` resolves);
**local dev is broken.** Note `layer-1-ingestion/config/symbols_mstock.json` **already exists with the correct
MStock tokens** and is never used.

**FIX-I2:** (a) **Fail closed** — a missing instrument map must ABORT ingestion with a named error, never
silently substitute another broker's tokens (rule 11; a wrong single-source-of-truth is worse than none — rule 14).
(b) Restore `layer-1-ingestion/vendor` → repo-root `vendor/` (symlink or path fix) so local == Docker; better,
resolve the map from ONE canonical path exported by `shared/`. (c) Delete or clearly quarantine the Kite-token
`config/symbols.json` fallback. (d) Regression test: assert the loaded MStock subscription list contains 2885 for
RELIANCE and NOT 256265.

### I3 🔴 — One MStock-specific list is broadcast to every vendor

`index.ts` builds the list from `item.tokens.mstock` only, and `manager.ts` L73 pushes **the same list to every
vendor**. A Kite or FlatTrade vendor therefore receives **MStock tokens** and fetches nothing.
**FIX-I3:** build the subscription list **per vendor** from `nifty50_shared.json` (`tokens[vendorName]`);
`VendorManager.subscribe()` maps symbol → per-vendor token. Fail loud if a vendor lacks a token for a symbol.

### I4 🟠 — MStock SDK version drift (silent breakage on upgrade)

Installed `@mstock-mirae-asset/nodetradingapi-typeb` exposes `subscribe(tokens: number[])` (lib/ticker.ts L257) —
our call matches. But the **vendor's own docs** describe `subscribe(exchange, tokens[], mode)` with
`MODE_LTP/QUOTE/SNAP`. An SDK upgrade will silently change the contract, and today **no feed mode is chosen**.
**FIX-I4:** pin the SDK version, add a startup assertion on `ticker.subscribe.length` (arity), and select the feed
mode explicitly once on the newer API.

### I5 🟡 — `maxReconnectionAttempts: 0` silently becomes 5
SDK does `config.maxReconnectionAttempts || 5` — `0` is falsy. Intent ("never auto-reconnect, we manage it") is
silently inverted, so SDK reconnects race our own `reconnectWS()`. **FIX:** pass an explicit sentinel the SDK
honors, or drop our custom reconnect and use the SDK's.

### I6 🟡 — Process-wide console monkey-patch
`mstock.js` L24–27 reassigns global `console.error`/`console.log` at import — affecting **every** module in L1,
despite the comment claiming it doesn't. **FIX:** filter inside the SDK's own logger/handlers, never globally.

> **Also blocking the dashboard even after I1–I3 are fixed:** ticks that DO arrive are only `SET` to Redis keys —
> they are never `PUBLISH`ed (GAP-B1), so the cockpit's WebSocket still shows nothing. I1–I3 restore the *feed*;
> B1 restores the *push*.

**Suggested order:** I2 (fail-closed + correct tokens) → I1 (token delivery + hot reconnect) → B1 (publish ticks)
→ I3 → I4–I6.

## 13. GAP-J — Security: the API is effectively UNAUTHENTICATED (blocks any public exposure)

**Context:** the owner has a static IP (`122.176.106.109`) with port `3029` open and intends to register a broker
redirect URL against it. **Public exposure is unsafe until J1/J2/J4 are fixed.**

### J1 🟣 — Authentication bypass (verified)

`layer-7-core-interface/api/src/index.ts` L110–118:

```js
fastify.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health' || req.url === '/' || req.url.startsWith('/documentation')) return;
  if (req.url.startsWith('/api/v1')) {
    if (req.headers['x-api-key']) {        // ⚠️ auth runs ONLY if a key is offered
      await fastify.authenticate(req, reply);
    }
  }
});
```

`AuthMiddleware.authenticate()` *does* correctly 401 on a missing key — but it is **never invoked** when the
header is absent. So a request with **no** `x-api-key` is served **unauthenticated**. Reachable without any
credential today:

- `GET /api/v1/providers/:provider/credentials/decrypted` → **plaintext api_key / password / totp_secret**
- `POST /api/v1/execution/kill` · `/resume` · `/square-off` → halt/resume live trading
- every market/signal/regime/order/strategy/risk route (read **and** PATCH)

**FIX-J1:** invert the gate — authenticate **every** `/api/v1/*` request by default, with an explicit allow-list
for public routes (`/health`, `/metrics`, `/documentation`). Fail closed (rule 11). Add a regression test:
a request with **no** `x-api-key` to `/api/v1/execution/state` MUST return 401. Additionally, the
`credentials/decrypted` route is an **internal** L1/L10 endpoint — bind it to a service-only key/network, never
expose it on the public listener.

### J2 🟣 — No TLS
API (4000) and dashboard (3000) are plain HTTP. Broker credentials, session JWTs and redirect codes would
transit in clear over the internet. **FIX-J2:** terminate TLS at a reverse proxy (Caddy/nginx) with a real
certificate; never expose the raw container ports. (A raw-IP `http://` redirect URI is also commonly *rejected*
by brokers.)

### J3 🔴 — No broker OAuth callback route (= GAP-E5)
No `/redirect`, `/callback` or `/auth/*` route is registered anywhere in L7. FlatTrade/Kite both require a
**registered redirect URI**; today's `flattrade.ts` strategy is a **manual-paste** flow
(`needs_request_code` → user copies `request_code` from the browser address bar).

**FIX-J3 / guidance for registering a redirect URL:**

| Broker | Redirect needed? | Note |
|---|---|---|
| MStock | ❌ No | TOTP flow (`login` → `verifyTOTP`); no redirect leg exists |
| FlatTrade | ✅ Yes | `https://auth.flattrade.in/?app_key=<api_key>` → returns `request_code` |
| Zerodha Kite | ✅ Yes | OAuth → returns `request_token` (daily; unattended login impossible by design) |

**Recommended today: register `http://127.0.0.1:3029/redirect` (localhost), NOT the public IP.** The manual-paste
flow works identically (the code is visible in the address bar), nothing is exposed, and brokers generally accept
localhost while rejecting plain-HTTP public IPs. Note `3029` is not in `shared/constants.js` `PORTS`
(BACKEND_API=4000, DASHBOARD=3000) — any real exposure needs an explicit mapping.
To automate the callback later: add `GET /api/v1/broker/:provider/callback` that captures `code`/`request_token`,
completes the token exchange via the existing strategy, and stores the session — then register that URL. Only
after J1/J2/J4.

### J4 🟣 — CORS `origin: '*'`
`index.ts` (CORS) and `plugins/websocket.ts` (socket.io) both allow any origin. Combined with J1, **any website a
logged-in operator visits could drive the trading API from their browser.** **FIX-J4:** restrict to the dashboard
origin(s); no wildcard in any deployed environment.

> **Bottom line:** J1 + J4 together mean the trading control plane is currently open to anyone who can reach the
> port. Keep it on localhost/LAN until fixed.

## 14. GAP-K — FlatTrade Pi Connect: spec conformance (verified against official docs v2.0, 31-Mar-2026)

Official facts that drive this section: base URL `https://piconnect.flattrade.in/PiConnectAPI`; 3-legged browser
auth (`https://auth.flattrade.in/?app_key=<API_KEY>` → redirect with **`?request_code=`**) → POST
`https://authapi.flattrade.in/trade/apitoken` with `api_secret = SHA256(api_key + request_code + api_secret)`;
**token valid 24h, cleared 05:00–06:00 IST (regenerate after 06:00)**; **token is returned ONLY if the request
originates from the registered static Primary IP**; registration requires **both a Redirect URL and a Postback URL**.

### K1 🔴 — Wrong base URL in the L7 strategy (and it bypasses `shared/`)

`layer-7-core-interface/api/src/modules/broker/strategies/flattrade.ts` L29 hardcodes:
`https://piconnect.flattrade.in/PiConnectTP/UserDetails` — but `shared/constants.js` states
`FLATTRADE: 'https://piconnect.flattrade.in/PiConnectAPI'  // NOT /PiConnectTP, no /REST/`.
L1's `flattrade.js` was corrected to `/PiConnectAPI` during the P0 pass; **L7's strategy was never fixed** — the
exact failure mode rule 14 exists to prevent (one truth, fixed in one place only). Effect: validating a
pre-generated `access_token` (jKey) hits a dead path.

**FIX-K1:** import `BROKER_BASE_URLS.FLATTRADE` / `.FLATTRADE_AUTH` / `.FLATTRADE_PORTAL` from `shared/constants.js`
in `flattrade.ts`; delete all three hardcoded URLs (`AUTH_API`, the `UserDetails` URL, the `auth.flattrade.in`
string). Regression test: assert no literal `piconnect.flattrade.in` / `authapi.flattrade.in` string exists
outside `shared/`, and that the strategy's URLs equal the shared constants.

### K2 🟣 — Session token cache expires EVERY HOUR (forces hourly manual re-login)

`flattrade.ts` L18: `ttlSeconds: secondsUntilNextISTHour`. With no target hour, `base.ts` L78 computes
`nextHour = currentHour + 1` ⇒ **TTL ≈ minutes-to-the-next-hour boundary**. Meanwhile
`canAuthenticateUnattended(): false` (L20) — FlatTrade *cannot* re-authenticate without a human browser step.

⇒ Every hour the Redis `broker:session:flattrade` key expires, L1/L10 lose the token, and the operator must
re-do the browser login **mid-trading-day**. The broker's token is actually valid for **24h** (cleared 05:00–06:00 IST).

**FIX-K2:** `ttlSeconds: (now) => secondsUntilNextISTHour(6, now)` — the helper already supports the
`(hour, now)` signature, so this is a one-line change giving a session that lives until the next 06:00 IST reset
(with the existing 120s safety margin). Regression test: TTL computed at 10:00 IST must be > 15 hours, not < 1.
Pair with the §9 session-monitor loop (alert the operator before the 06:00 expiry, don't discover it at 09:15).

### K3 🔴 — No Postback (webhook) endpoint

FlatTrade's app registration requires a **Postback URL** — "URL to which you will be receiving order updates for
the orders placed through API" (§9 POSTBACK/WEBHOOK in their docs). **No such route exists in L7.** Without it,
order fills/rejects are only discoverable by polling; the cockpit's live order/position updates stay blind.

**FIX-K3:** add `POST /api/v1/broker/flattrade/postback` — validate the payload, normalize to the
`execution-events` contract, publish on `REDIS_CHANNELS.EXECUTION_EVENTS` (closes part of GAP-B5) and journal it.
Must be **publicly reachable** (FlatTrade's servers call it) ⇒ see the exposure constraints in §13.

### K4 🟠 — Static-IP binding is undocumented in deployment

"Token will be returned only if the request originates from the **registered private static IP** for the API key."
⇒ the **egress IP of the L7 container** (not the browser) must equal the registered Primary IP. If L7 runs behind
NAT/VPN/cloud with a different egress, token exchange fails with a confusing error.
**FIX-K4:** document the required egress IP in `DEPLOYMENT.md`; add a startup/self-test that reports L7's public
egress IP and warns loudly if it differs from a configured `FLATTRADE_REGISTERED_IP`. Also note: separate API keys
are required for PROD vs TEST if their redirect URLs differ.

### K5 🟡 — `docs/BROKER_LOGIN_FLOWS.md` FlatTrade section is stale
It documents base `/PiConnectTP` and claims "No separate login step — the API key is used as the credential" —
contradicted by the official 3-legged flow (and by `flattrade.ts`'s own header: *"Not 'API key is the token' — that
was wrong"*). **FIX-K5:** rewrite that section from the official docs; mark it 🟢 in `docs/INDEX.md` once corrected.

### Registration cheat-sheet (what to enter in the FlatTrade Wall form)

| Field | Value | Note |
|---|---|---|
| Primary IP | your static IP | must be **L7's egress IP** — token exchange is IP-bound (K4) |
| Redirect URL | `…/redirect` | browser lands here with `?request_code=…`; a **localhost** URL works for today's manual-paste flow |
| Postback URL | `…/postback` | **must be publicly reachable** (K3) — this is the one that forces public exposure |

## 12. Hand-off

- **For the implementing AI:** work §4 in order; treat §6 as the done-bar; every fix imports names from
  `shared/constants.js`; never leave both relays alive; encode each dead wire from §3 as an assertion in
  `scripts/verify-wiring.js` so regressions fail loudly.
- **Open verification (human or next agent, graphify-first):**
  - GAP-B6 — confirm the L5 Go aggregator `Publish`es `market_view`; B4 — decide the alerts channel convention (single channel vs `pSubscribe('notifications:*')`).
  - GAP-E1 — confirm no session refresh loop exists anywhere else (scheduler/cron); E3 — read the `/providers/:provider/status` handler (presence vs liveness); E5 — assess `kite.ts` completeness for the daily request_token flow.
  - GAP-F2 — is `index_membership` populated and joined by breadth/backtest? F3 — which of alerts/strategy_registry/backtest_runs/prediction_log tables already exist? F4 — audit writer INSERTs for ON CONFLICT; F5/F6 — confirm exact `trades`/`order_log` columns and the aggregate ladder.
- **Working rules for whoever picks this up:** graphify for every codebase query (rule 1); channel/key/topic names only from `shared/constants.js` (rule 3/14); never leave two WS relays alive; every fixed gap becomes a named assertion in `scripts/verify-wiring.js`; fail closed — no fabricated values (rules 11/13); see `.ai/skills/wiring-gaps.md`.
