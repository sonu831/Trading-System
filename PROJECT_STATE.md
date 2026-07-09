# PROJECT_STATE.md — Where the System Stands

> **Purpose:** one-page, honest snapshot of the whole Trading-System — what's built, what's in flight, what's
> missing. Update this at the end of any non-trivial session. For durable decisions see [`.ai/MEMORY.md`](.ai/MEMORY.md);
> for fast-changing working notes see [`MEMORY.md`](MEMORY.md); for architecture see [`CLAUDE.md`](CLAUDE.md).
>
> **Last updated:** 2026-07-09 · **Branch:** `nifty-trading-plan`
> **Status legend:** ✅ built · 🟡 partial/scaffolded · 🔨 in design · ❌ not started · ❓ unverified this session

---

## 1. One-Line Summary

A 9-layer, event-driven (Kafka) NIFTY-50 trading platform is in place (ingestion → candles → analysis →
breadth → signals → API → Telegram/dashboard). **Current focus:** an automated **momentum** options module
(scalping + positional) on NIFTY/BANKNIFTY — designed, partially scaffolded, **not yet live**.

---

## 2. Layer Status

| Layer | Purpose | Status | Notes |
|---|---|---|---|
| L1 Ingestion (Node) | Broker ticks → Kafka | ✅ | Zerodha/MStock adapters; index spot + option chain **not yet** (❌, needed for momentum) |
| L1 FlatTrade (Py) | Broker adapter | ✅ | `NorenApiPy.placeOrder()` exists — usable for execution |
| L1c TradingView MCP | AI chart analysis (68 tools) | ✅ | Bias/regime input; not in tick pipeline |
| L2 Processing (Node) | Ticks → candles | ✅ | Publishes `market_candles` |
| L3 Storage | TimescaleDB + Redis (CQRS) | ✅ | Execution schema (migration 005) ❌ not added |
| L4 Analysis (Go) | Indicators + per-stock scores | ✅ | RSI/MACD/EMA/Supertrend/ATR/VWAP; `calculateMomentumScore`, `calculateTrendScore` |
| L5 Aggregation (Go) | **Breadth + sector rotation** | ✅ | `CalculateBreadth()`, `SectorMetrics`, `MarketView` — the momentum regime engine |
| L6 Signal (Node) | Buy/sell signals | 🟡 | Per-stock signals exist; **index-momentum generator 🔨 to build** |
| L7 Core API (Node) | Fastify REST + Socket.io | ✅ | Signals module + WebSocket present |
| L8 Presentation (Node/React) | Telegram bot, dashboard | ✅ | Alerts, `/kill`, market commands |
| L9 AI Service (Py) | ML inference | ✅/❓ | Present; role in momentum = optional backtest/scoring |
| **L10 Execution (Node)** | **Order execution engine** | 🟡 | Config fully designed ([`default.js`](layer-10-execution/config/default.js)); most src modules ❌ |
| Infra | Docker, Kafka, Prometheus/Grafana/Loki | ✅ | `execution` service not yet wired |

> ❓ **Not verified this session:** runtime health, test pass/fail, and whether each service actually boots.
> Status above reflects code presence (via graphify) + design docs, not a live smoke test.

---

## 3. Momentum Module — Current State

**Design intent (owner-confirmed):** an **adaptive** system — strategies are pluggable (not hardcoded), a
multi-timeframe **regime engine** reads the market state and routes to whichever strategy fits, and an
optimization loop tunes params per regime (live promotion human-gated). Three timeframe tiers: T1 scalp (1–5m),
T2 intraday (10–30m), T3 positional (1h–daily, overnight long-only). Lag acceptable → event-pipeline default.

- **Design doc:** ✅ [`docs/MOMENTUM_TRADING_ARCHITECTURE.md`](docs/MOMENTUM_TRADING_ARCHITECTURE.md) (tiers, regime engine, strategy framework, optimizer, best scalping strategy).
- **Hot-path spec (optional upgrade):** ✅ [`docs/OPTIONS_SCALPING_RULES.md`](docs/OPTIONS_SCALPING_RULES.md).
- **Strategy plugin #2 spec:** ✅ [`layer-1-tradingview/strategies/nifty-banknifty-trend-pullback.md`](layer-1-tradingview/strategies/nifty-banknifty-trend-pullback.md).
- **Breadth/sector inputs (regime engine feed):** ✅ built in L5.
- **Multi-TF Regime Engine:** 🔨 to build (the "understand the market moment" core).
- **Adaptive Strategy Framework (registry + router):** 🔨 to build in L6.
- **Backtest harness (2-stage) + optimizer:** 🔨 to build (scripts + L9).
- **Execution engine (L10):** 🟡 scaffold + config only; OMS/risk/strike/position-manager ❌ (FlatTrade-first).
- **Data gaps:** index multi-TF spot ❓, option chain ❌, India VIX ❌ (see architecture §6).

### Owner decisions (RESOLVED 2026-07-09)
Scalp feed = **Zerodha + FlatTrade (failover)** · Execution broker = **FlatTrade** · Positional overnight =
**yes, long-only** · Backtest = **full 2-stage** · Sizing = **2–3 lots** · Strategy = **pluggable/adaptive**.

---

## 4. Biggest Gaps / Risks (ordered)

1. **Option-chain data pipeline** ❌ — the one genuinely new, non-trivial ingestion. Blocks strike selection,
   liquidity gate, premium-based stops.
2. **Historical option data for backtest** ❌ — hard to source retail; interim plan = validate signal on index
   data + record option snapshots forward.
3. **L10 execution modules** ❌ — OMS, risk manager, strike selector, position manager still to be written.
4. **Index spot + India VIX ingestion** ❓/❌ — verify/add.
5. **Compliance** — SEBI retail-algo registration + broker API rate limits unconfirmed (blocks *live* only).

---

## 5. Immediate Next Steps

1. Owner: answer the open decisions in [architecture §11](docs/MOMENTUM_TRADING_ARCHITECTURE.md) (scalp data
   source, primary broker, overnight policy, backtest ambition, capital/sizing).
2. Data: verify index-spot flow; build option-chain poller; add India VIX.
3. Signal: implement index-momentum generator in `layer-6-signal`; backtest on index + breadth history.
4. Execution: finish `layer-10-execution` in **paper mode first**; add migration 005.

---

## 6. Guardrails In Force

- **No live trading** until the validation roadmap passes (backtest → paper ≥2wk → shadow → 1-lot live).
- **Never sell options** (long premium only, defined risk).
- Repo rules: graphify-first search, RTK-prefixed commands, shared-tier dedup, event-driven contracts, CQRS,
  no hardcoded secrets, **no git writes without owner instruction**.
