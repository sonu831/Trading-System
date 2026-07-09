# PROJECT_STATE.md — Where the System Stands

> **Purpose:** one-page, honest snapshot of the whole Trading-System — what's built, what's in flight, what's
> missing. Update this at the end of any non-trivial session. For durable decisions see [`.ai/MEMORY.md`](.ai/MEMORY.md);
> for fast-changing working notes see [`MEMORY.md`](MEMORY.md); for architecture see [`CLAUDE.md`](CLAUDE.md).
>
> **Last updated:** 2026-07-09 (Phases A-F built) · **Branch:** `nifty-trading-plan`
> **Status legend:** ✅ built · 🟡 partial/scaffolded · 🔨 in build · ❌ not started · ❓ unverified this session

---

## 1. One-Line Summary

A 9-layer, event-driven (Kafka) NIFTY-50 trading platform is in place (ingestion → candles → analysis →
breadth → signals → API → Telegram/dashboard). **Current focus:** an automated **momentum** options module
(scalping + positional) on NIFTY/BANKNIFTY — designed, partially scaffolded, **not yet live**.

---

## 2. Layer Status

| Layer | Purpose | Status | Notes |
|---|---|---|---|
| L1 Ingestion (Node) | Broker ticks → Kafka | ✅ | Fixed normalizer bug (MStock token resolution); option-chain poller built (FlatTrade) 🔨; index instruments in config (tokens need user verification) |
| L1 FlatTrade (Py) | Broker adapter | ✅ | `NorenApiPy.placeOrder()` exists — usable for execution |
| L1c TradingView MCP | AI chart analysis (68 tools) | ✅ | Bias/regime input; not in tick pipeline |
| L2 Processing (Node) | Ticks → candles (live) + backfill | ✅ | **CandleAggregator built** — proper 1m OHLC from tick stream (was writing ticks as 1m candles) |
| L3 Storage | TimescaleDB + Redis (CQRS) | ✅ | Migration 005 added (trades, order_log, pnl_snapshots hypertables) |
| L4 Analysis (Go) | Indicators + per-stock scores | ✅ | RSI/MACD/EMA/Supertrend/ATR/VWAP; `calculateMomentumScore`, `calculateTrendScore` |
| L5 Aggregation (Go) | **Breadth + sector rotation** | ✅ | Filters out NIFTY/BANKNIFTY/INDIAVIX from breadth; publishes `market_view` to Redis |
| L6 Signal (Node) | Signal + Regime Engine + Strategy Framework | 🟡 | **Regime Engine (Phase B)** + **Strategy Framework (Phase C)** — pluggable strategies with regime-affinity routing; momentum-burst + trend-pullback plugins; publishes to `trade-signals` topic; per-stock legacy signals also active |
| L7 Core API (Node) | Fastify REST + Socket.io | ✅ | Signals module + WebSocket present |
| L8 Presentation (Node/React) | Telegram bot, dashboard | ✅ | Alerts, `/kill`, market commands |
| L9 AI Service (Py) | ML inference | ✅/❓ | Present; role in momentum = optional backtest/scoring |
| **L10 Execution (Node)** | **Order execution engine** | ✅ | FlatTrade-first OMS, risk manager, position manager, strike selector, trade journal, paper/shadow/live modes; migration 005 |
| Infra | Docker, Kafka, Prometheus/Grafana/Loki | ✅ | `execution` service added to docker-compose.app.yml |

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
- **Multi-TF Regime Engine:** ✅ built (Phase B) — 5m/15m/1h/D classifier, publishes to `market-regime` topic + Redis.
- **Adaptive Strategy Framework (registry + router):** ✅ built (Phase C) — momentum-burst + trend-pullback plugins.
- **Backtest harness (2-stage) + optimizer:** ✅ built (Phase D) — signal backtest + option-leg simulator + grid optimizer + decay monitor + human-gated promotion.
- **Execution engine (L10):** ✅ built (Phase E) — FlatTrade-first OMS, risk manager, position manager, strike selector, trade journal, paper/shadow/live modes.

### Phase F — Validation Roadmap (🔨 built 2026-07-09)
| Component | Status | Notes |
|-----------|--------|-------|
| Backtest checkpoint | ✅ | `backtest-check.js` — PF≥1.3, expectancy≥+0.25R, ≥60 trades per profile |
| Paper checkpoint | ✅ | `paper-check.js` — ≥14 days, ≥20 trades, avg slippage <0.5% |
| Shadow checkpoint | ✅ | `shadow-check.js` — ≥7 days, ≥10 manual trades, accuracy ≥60% |
| Live gate | ✅ | `live-gate.js` — SEBI registration, broker rate limits, 20-trade min before scale |
| Checkpoint tracker | ✅ | `checkpoints.js` — JSON state persistence, sequential pass/fail |
| CLI runner | ✅ | `run.js` — `node run.js status\|run\|reset\|advance [checkpoint]` |

### Phase E — Execution Engine Layer 10 (🔨 built 2026-07-09)
| Component | Status | Notes |
|-----------|--------|-------|
| Entry point + Kafka consumer | ✅ | `src/index.js` — subscribes to `trade-signals`, Express API on port 8090 |
| FlatTrade OMS | ✅ | `src/oms/flattrade.js` — place/modify/cancel orders, order book, positions, quotes via Noren API |
| MStock OMS | ✅ | `src/oms/mstock.js` — place/modify/cancel orders via MStock TypeB API |
| Risk manager | ✅ | `src/risk/manager.js` — max positions, max trades/day, daily loss circuit breaker, kill switch, lot sizing |
| Position manager | ✅ | `src/risk/position-manager.js` — open/close/trail positions, SL/target/time-stop exits, trailing stop |
| Strike selector | ✅ | `src/strike-selector.js` — ATM/ITM-1 strike, NFO symbol generation, expiry resolution |
| Trade journal | ✅ | `src/trade-journal.js` — writes to `trades`, `order_log`, `pnl_snapshots` hypertables (migration 005) |
| Paper executor | ✅ | `src/paper-executor.js` — TRADE_MODE=paper (simulated fills vs live LTP) + shadow mode |
| Quote feed | ✅ | `src/quote-feed.js` — broker (FlatTrade/MStock) or synthetic random-walk for offline dev |
| Redis commands | ✅ | Subscribes to `execution:commands` (KILL/RESUME from Telegram); reads `execution:kill_switch` |
| Dockerfile | ✅ | Node 20-alpine, healthcheck, ports 8090 |
| docker-compose | ✅ | Execution service added to `docker-compose.app.yml` with all env vars |

### Phase D — Backtest Harness + Optimizer (🔨 built 2026-07-09)
| Component | Status | Notes |
|-----------|--------|-------|
| Signal backtest engine (Stage 1) | ✅ | `scripts/backtest/backtest-runner.js` — fetches candles from TimescaleDB, runs strategies over historical data, computes trade-level metrics |
| Option-leg simulator (Stage 2) | ✅ | `scripts/backtest/option-simulator.js` — Black-Scholes premium model with slippage + IV crush cost layer, delta tracking |
| Grid Search optimizer | ✅ | `scripts/backtest/optimizer.js` — walk-forward grid search over strategy params; scores by profit factor + expectancy + drawdown + train/test consistency |
| Per-regime optimization | ✅ | Groups results by regime bucket; finds optimal params per market regime |
| Decay monitor | ✅ | `scripts/backtest/decay-monitor.js` — compares live trade expectancy vs backtest baseline; auto-alerts on drift beyond threshold |
| Human-gated promotion workflow | ✅ | `scripts/backtest/promotion-manager.js` — propose → review (approve/reject) → promote to live; demote on decay |
| CLI entry point | ✅ | `scripts/backtest/run.js` — `node run.js [backtest|optimize|promote] [strategy-id]` |
| Backtest metrics | ✅ | Win rate, profit factor, expectancy, Sharpe ratio, max drawdown, grouped by regime |

### Phase C — Adaptive Strategy Framework (🔨 built 2026-07-09)
| Component | Status | Notes |
|-----------|--------|-------|
| Base strategy interface | ✅ | `BaseStrategy` class with `evaluateEntry(ctx)` / `manage(position, ctx)` contract |
| Strategy registry | ✅ | Register/enable/disable via `config.json` — no redeploy to tune |
| Regime-affinity router | ✅ | Picks matching strategies per regime; gates by tradeable tiers; blocks HIGH vol unless opt-in |
| Momentum-burst plugin (§3.6) | ✅ | T1 scalp: 5m expansion candle + breadth confirmation + RSI/volume gates + structure break |
| Trend-pullback plugin | ✅ | T2 pullback: price near EMA21 in trending regime + RSI/volume rejection confirmation |
| Strategy config file | ✅ | `src/strategies/config.json` — tune params, enable/disable without redeploy |
| Kafka `trade-signals` topic | ✅ | Signals tagged with `strategyId`, `tier`, `regime`, `reasons[]`, `params` |
| `/strategies` API endpoint | ✅ | Returns active strategies + registry stats on L6 |

### Phase B — Regime Engine (🔨 built 2026-07-09)
| Component | Status | Notes |
|-----------|--------|-------|
| Multi-TF indicator library | ✅ | Trend (ADX+EMA), volatility (ATR+VIX), phase detection |
| TF classifier (5m/15m/1h/D) | ✅ | Aggregates 1m candles if higher TF tables unavailable |
| TF alignment detection | ✅ | Computes agreement across timeframes → confidence score |
| RegimeState output | ✅ | Includes trend/strength/volatility/phase/tfAlignment/tradeableTiers |
| Redis publish | ✅ | `market-regime` channel + `market-regime:latest` key |
| Kafka publish | ✅ | `market-regime` topic — full regime state JSON |
| Regime-aware signals | ✅ | Regime context attached to trade signals |
| `/regime` API endpoint | ✅ | Returns current regime state at `/regime` on L6 |
| Subscribes to L5 breadth | ✅ | Reads `market_view` from Redis for breadth + sector data |

### Phase A — Data Foundation (🔨 built 2026-07-09)
| Component | Status | Notes |
|-----------|--------|-------|
| Index instruments (NIFTY/BANKNIFTY/VIX) in shared map | ✅ | Tokens need user verification from MStock UI |
| Normalizer fix (SymbolRegistry instead of config/symbols.json) | ✅ | Fixes streaming bug — all MStock ticks were being rejected |
| Kafka partition map extended for indices | ✅ | Indices mapped to partitions 50+ |
| Tick-to-candle aggregation (L2) | ✅ | New `CandleAggregator` service — proper 1m OHLC from tick stream |
| Option chain poller (L1) | ✅ | Polls FlatTrade API for ATM±5 chain every 3s, publishes to `option-chain` topic |
| Execution schema (migration 005) | ✅ | `trades`, `order_log`, `pnl_snapshots` hypertables |
| Shared Kafka topic contracts | ✅ | `shared/TOPICS.md` — all new topics documented |
| L5 breadth excludes index symbols | ✅ | NIFTY/BANKNIFTY/VIX filtered from breadth calculations |

### Owner decisions (RESOLVED 2026-07-09)
Scalp feed = **Zerodha + FlatTrade (failover)** · Execution broker = **FlatTrade** · Positional overnight =
**yes, long-only** · Backtest = **full 2-stage** · Sizing = **2–3 lots** · Strategy = **pluggable/adaptive**.

---

## 4. Biggest Gaps / Risks (ordered)

1. **MStock index tokens unverified** ❌ — NIFTY, BANKNIFTY, INDIAVIX tokens need user to provide from MStock UI.
2. **Regime engine + strategy framework unverified against live data** ❓ — built from code logic; needs verification against real candle + breadth data.
3. **Historical option data for backtest** ❌ — hard to source retail; interim plan = validate signal on index data + record option snapshots forward.
4. **L10 execution not tested** ❓ — built in paper mode; needs end-to-end test with live signals.
5. **Option chain poller unverified** ❓ — configured for FlatTrade API; may need adaptation for MStock.
6. **Compliance** — SEBI retail-algo registration + broker API rate limits unconfirmed (blocks *live* only).

---

## 5. Immediate Next Steps

1. **Provide MStock index tokens** — Check MStock UI for NIFTY/BANKNIFTY/INDIAVIX tokens, update `vendor/nifty50_shared.json`.
2. **Run `npm install`** in `layer-6-signal/`, `layer-10-execution/`, `scripts/backtest/`, and `scripts/validation/`.
3. **Run validation**: `node scripts/validation/run.js run backtest` to start Phase F.
4. **Phase G (optional)** — Hot-path upgrade for T1 (§9), if Event Pipeline proves too slow.

---

## 6. Guardrails In Force

- **No live trading** until the validation roadmap passes (backtest → paper ≥2wk → shadow → 1-lot live).
- **Never sell options** (long premium only, defined risk).
- Repo rules: graphify-first search, RTK-prefixed commands, shared-tier dedup, event-driven contracts, CQRS,
  no hardcoded secrets, **no git writes without owner instruction**.
