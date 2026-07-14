# Cockpit Backend Plan — Wiring the 9-Layer System to `cockpit-app`

> ⚠️ **PARTIALLY STALE (2026-07-11, same day):** most 🔴 gaps below (§4 #1, 3, 5, 6, 7, 8) were built by a
> concurrent integration pass — options/orders/backtest/strategies/alerts/risk routes now exist in L7. The
> realtime section (§5) is **superseded by [`WIRING_GAPS_AND_FIXES.md`](WIRING_GAPS_AND_FIXES.md)**, which is
> the code-verified, active wiring plan. Keep this doc for the layer/data-source map (§1–§3).

> **Purpose:** the definitive map from every screen/panel in
> [`docs/design/mockups/cockpit-app.html`](design/mockups/cockpit-app.html) to the **backend layer, endpoint,
> topic, or Redis key** that must feed it — what already exists, what is partial, and exactly what to build.
> **Grounded in the real code** (graphify + route files, verified 2026-07-11), not assumptions.
> Read with: [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md),
> [`FULL_COCKPIT_DESIGN_PROMPT.md`](design/FULL_COCKPIT_DESIGN_PROMPT.md),
> [`PREDICTIVE_MODEL_BUILD_PROMPT.md`](PREDICTIVE_MODEL_BUILD_PROMPT.md).

## 0. Headline

**~70% of the backend the cockpit needs already exists.** Layer 7 (Fastify API, port 4000) already serves
market-view, breadth, regime, signals, execution state/controls, strike-preview, brokers, analysis, and system
health, plus a Socket.io realtime gateway and Swagger docs at `/documentation`. The work is **not** a rebuild —
it's closing ~8 specific gaps and widening the realtime push. This doc names each one and where it lives.

---

## 1. What the backend is today (the 10 layers)

| Layer | Tech · Port | Produces | Consumed by cockpit via |
|---|---|---|---|
| L1 Ingestion | Node · 9101 | `raw-ticks`, `option-chain`, index+VIX ticks, `ltp:*` (Redis) | WS ticks, spot in SafetyBar |
| L2 Processing | Node · 3002 | `market_candles`, `candle:*:latest` (Redis) | charts |
| L4 Analysis | Go · 8081 | `analysis_updates`, `indicator:*` (Redis) | Symbol Analysis, chart overlays |
| L5 Aggregation | Go · 8080 | breadth + sector momentum → `sentiment_scores`, `market_view` (Redis) | `/market-view`, `/breadth/latest` |
| L6 Signal | Node · 8082 | `trade-signals`, `market-regime` (+ Redis `market-regime:latest`), strategy registry | `/signals`, `/regime/latest` |
| L7 Core Interface | Node/Fastify · 4000 | **the REST + Socket.io surface the cockpit calls** | *(this is the gateway)* |
| L9 AI Service | Python/FastAPI · 8000 | `/predict`, `/backtest`, `/analyze_market` (predict is a **stub**) | Predictions, Backtest *(not yet proxied)* |
| L10 Execution | Node · 8095 | `execution-events`, positions/kill (Redis `execution:*`) | `/execution/*` (L7 proxies L10) |
| L8 Presentation | Node/React · 3000 | the cockpit itself + Telegram/email; `notifications` topic | — |
| L3 Storage | TimescaleDB + Redis | history + live KV | everything above |

**Shared contracts (single source of truth — `shared/constants.js`):** `KAFKA_TOPICS` (raw-ticks, market_candles,
analysis_updates, sentiment_scores, trade-signals, notifications, option-chain, market-regime, execution-events…),
`REDIS_KEYS` (ltp, candle:latest, indicator, market_view, market-regime:latest, signal:latest, option-chain,
execution:, broker:session), `PORTS`, and enums the cockpit already speaks: `REGIME_TREND/VOLATILITY/PHASE`,
`SIGNAL_TIER` (T1/T2/T3), `SECTOR_MOMENTUM`, `TRADE_MODE`, `OPTION_TYPE`.

---

## 2. The L7 API surface that exists **today** (verified in route files)

| Method · Route | Feeds | Source |
|---|---|---|
| `GET /api/v1/market-view` | Overview breadth/movers/sentiment | L5 `market_view` (Redis) |
| `GET /api/v1/breadth/latest` | Market Internals (breadth + sectors) | L5 `breadth.go`/`aggregator.go` |
| `GET /api/v1/regime/latest` | Regime screen + chip (`null` until engine publishes) | L6 `market-regime:latest` |
| `GET /api/v1/signals` | Signals feed | L6 `trade-signals` / `signal:*:latest` |
| `GET /api/v1/execution/state` | Positions, trade mode, kill state, Day P&L | L10 (proxied) |
| `POST /api/v1/execution/kill` · `/resume` · `/square-off` | KillSwitch, resume-confirm, square-off | L10 |
| `GET /api/v1/execution/strike-preview` | **Scalp "Engine Intent" card** (strike/premium/SL/target/lots) | Redis `ltp:*` + sizing |
| broker module routes | Brokers screen (providers/credentials/test) | L7 broker module + `broker:session` |
| analysis module routes | Symbol Analysis `/analysis/[symbol]` | L4 + `analysis_updates` |
| system module routes · `/health` · `/metrics` | System Health | health-check + Prometheus |
| `GET /documentation` (Swagger UI) | — (dev) | — |
| **WS (Socket.io)** rooms `market-stream`→`tick`, `signals-stream`→`signal` | live ticks, live signals | Redis pub/sub `market_ticks`, `signals` |

Auth: `X-API-KEY` header (optional today); CORS open; Prometheus on every route.

---

## 3. Screen → backend map (the heart of this doc)

Legend: ✅ **BUILT** (endpoint exists) · 🟡 **PARTIAL** (data exists, needs an endpoint/enrichment) · 🔴 **GAP** (build it).

| Cockpit screen / panel | Data needed | Backend source | Status |
|---|---|---|---|
| **SafetyBar** — spot, VIX, mode, kill | `ltp:NIFTY/BANKNIFTY/INDIAVIX`, exec state | WS `tick` + `/execution/state` | 🟡 need VIX + spot pushed on WS |
| **Overview** — stat tiles, A/D, regime chip, movers, signals | market-view, regime, signals | `/market-view`, `/regime/latest`, `/signals` | ✅ |
| **Scalp** — chart | candles + VWAP/EMA | `candle:*:latest`, `analysis_updates` | 🟡 need candles endpoint or WS candle stream |
| **Scalp** — option chain | ATM±N CE/PE LTP/OI/IV | `option-chain` topic → `option-chain:{u}` (Redis) | 🟡 need `/api/v1/option-chain/:underlying` |
| **Scalp** — Engine Intent | strike/premium/SL/target/lots | `/execution/strike-preview` | ✅ |
| **Scalp** — confluence rail | prediction %, breadth ✓, tier | `/breadth/latest`, `/regime/latest`, prediction | 🟡 (prediction is 🔴) |
| **Positions & P&L** | open positions, P&L, daily risk | `/execution/state` | ✅ (confirm P&L fields populated) |
| **Orders & Execution** | order book, fills, rejects, latency | `execution-events` + L10 journal (TimescaleDB `order_log`) | 🔴 add `GET /api/v1/execution/orders` |
| **Market Internals** — A/D, %VWAP, sectors | breadth + sector momentum | `/breadth/latest` | ✅ |
| **Market Internals** — Heavyweight contribution | per-stock weight × %move → index points | needs per-constituent contribution calc | 🔴 enrich L5 `market_view` (or L7) with `contributions[]` |
| **Regime** — panel, tfAlignment, tiers | RegimeState | `/regime/latest` | ✅ (needs L6 engine actually publishing) |
| **Predictions / AI** | prob UP/DOWN/FLAT, features, confidence | L9 `/predict` (**untrained stub**) | 🔴 proxy via L7 + train (Phase 0 first) — see below |
| **Signals** — feed + history + filter | `trade-signals` history | `/signals` | 🟡 add `?tier/&strategy/&from` filters + history |
| **Backtest Lab** | run + results | L9 `/backtest` | 🔴 add `POST /api/v1/backtest` proxy |
| **Strategies** — registry, enable/disable, stats | L6 strategy registry | L6 strategy framework | 🔴 add L7 `strategies` module (`GET/PATCH /api/v1/strategies[/:id]`) |
| **Risk** — config get/save | risk envelope | `layer-10-execution/config/default.js` | 🟡 confirm/add `GET·PATCH /api/v1/risk/config` (the page already calls it) |
| **Brokers** | providers/credentials/test | broker module | ✅ |
| **Settings** | theme/display (client), notif prefs | client + `/subscribers` | ✅ mostly client |
| **Backfill** | coverage grid, job progress | L1 backfill jobs | 🟡 confirm status endpoint |
| **Swarm** | worker/queue stats | swarm workers | 🔴 add status endpoint |
| **System Health** | per-layer up/down/lag | `/health`, `/metrics`, system module | ✅ (map layers → tiles) |
| **Alerts / Notifications** | notification feed | `notifications` topic (L8) | 🔴 add `GET /api/v1/alerts` + persist feed |
| **Symbol Analysis** `/analysis/[symbol]` | per-stock indicators/patterns/PCR | analysis module | ✅ |

**Net:** ~13 panels ✅ BUILT, ~6 🟡 PARTIAL (endpoint/enrichment), ~7 🔴 GAP.

---

## 4. The gaps — exactly what to build, and where

Each stays in its correct layer; every new constant/topic/key goes in `shared/` (rule 3/14); consumers idempotent
(rule 4); Redis reads / TimescaleDB writes (rule 5); fail-closed & never fabricate (rules 11/13).

1. **Option-chain endpoint (L7)** — `GET /api/v1/option-chain/:underlying` reading Redis `option-chain:{u}` (populated by L1 poller). Add a `market`/`options` controller method. *Feeds Scalp.* — small.
2. **Heavyweight contribution (L5 → market_view)** — extend `aggregator.go`/`breadth.go` to emit `contributions[]` (symbol, weight, pct_move, index_points, leading/lagging) into `market_view`. Requires **point-in-time constituent weights** (see predictive doc's survivorship note). *Feeds Market Internals.*
3. **Orders endpoint (L7 ← L10)** — `GET /api/v1/execution/orders` proxying L10 journal / `order_log` hypertable (status, latency, ordertag, strategy, reject reason). *Feeds Orders & Execution.*
4. **Predictions proxy (L7 ← L9)** — `GET /api/v1/predict?underlying=&horizon=` proxying L9 `/predict`, returning calibrated prob + features + `model_version` + freshness, **or an explicit abstain** when unavailable. **Gated:** the model is a stub — until the Phase-0 breadth study proves a post-cost edge, this returns the abstain state the cockpit already designs. *Feeds Predictions.*
5. **Backtest proxy (L7 ← L9)** — `POST /api/v1/backtest` proxying L9 `/backtest`; return equity curve + PF + expectancy + DD + promotion state. *Feeds Backtest Lab.*
6. **Strategies module (L7 ← L6)** — `GET /api/v1/strategies`, `GET /:id`, `PATCH /:id` (enable/disable/params) over the L6 pluggable registry. *Feeds Strategies.*
7. **Alerts endpoint (L7)** — persist the `notifications` topic to a small store and expose `GET /api/v1/alerts` (severity, message, ts) + mark-read. *Feeds Alerts.*
8. **Risk config (verify/complete)** — the Risk page already `fetch`es `GET·PATCH /api/v1/risk/config`; confirm it's served (add a `risk` module proxying L10 config if 404). *Feeds Risk.*
9. **Swarm status (verify/add)** — expose worker/queue/error counts. *Feeds Swarm.*

---

## 5. Realtime — widen the Socket.io push

Today `SocketService` broadcasts only `tick` (`market-stream`) and `signal` (`signals-stream`) from Redis pub/sub.
The cockpit is a live terminal — add these rooms/events (L6/L10 publish to the Redis channel, L7 relays):

| Event | Room | Publisher → channel | Cockpit consumer |
|---|---|---|---|
| `regime` | `regime-stream` | L6 → `market-regime` | Regime + Overview chip |
| `breadth` | `market-stream` | L5 → `market_view` | Overview, Market Internals |
| `execution` | `exec-stream` | L10 → `execution-events` | Positions, Orders, SafetyBar |
| `alert` | `alerts-stream` | L8 → `notifications` | Alerts (toast + list) |
| `prediction` | `ai-stream` | L9/L6 → predictions | Predictions, confluence rail |

Rule: **push state changes, poll only for on-demand detail.** Every pushed payload carries a timestamp so the UI can
show `StaleBadge` when it ages out (freshness is a safety property — rule 13).

---

## 6. Build sequence (matches the frontend order)

1. **Nothing-new screens first** — Overview, Regime, Market Internals (breadth), Signals, Positions, Brokers, System, Symbol Analysis all have live endpoints today. Wire the frontend organisms to them (via the hooks/containers in the atomic restructure). *No backend work.*
2. **Small endpoints** — option-chain (#1), orders (#3), risk verify (#8): low effort, unblock Scalp/Orders/Risk.
3. **Proxies** — backtest (#5), strategies (#6), alerts (#7): thin L7 modules over existing L6/L9/L8.
4. **Enrichment** — heavyweight contributions (#2) in L5.
5. **Realtime** — widen Socket.io (§5).
6. **Predictions last** — Phase-0 breadth study → prove edge → train → then wire proxy (#4). Until then the `/ai` screen renders the abstain state. **Never ship a fabricated prediction.**

---

## 7. Non-negotiables (carried from the contract)

- **Event-driven only** between layers (Kafka); no direct HTTP between layers 1–6/10 — L7 is the *only* aggregation/proxy point for the UI. Consumers idempotent.
- **CQRS** — cockpit reads hit Redis-backed L7 endpoints; writes (kill/resume/square-off/config) go through L7 → L10.
- **One source of truth** — every new endpoint's constants/enums/topic/key live in `shared/`. No per-layer redeclaration.
- **Fail-closed, never fabricate** — an endpoint with no data returns `null`/abstain/`—`, never a confident `0`. Stale data announces itself.
- **Predictions are gated** — no live prediction influence until the Phase-0 study + validation roadmap (§12) pass; promotion is human-gated.
- **Verify by execution** — each new endpoint ships with a smoke test; each realtime event with a subscribe test.

---

## 8. TL;DR for the owner

You do **not** need a new backend. You need: **2 tiny endpoints** (option-chain, orders), **1 enrichment**
(heavyweight contributions in L5), **3 thin proxies** (backtest, strategies, alerts), **verify 2** (risk, swarm),
**widen realtime** (5 more Socket.io events), and **hold predictions** behind the Phase-0 study. Everything else the
cockpit shows is already served by Layer 7 today.
