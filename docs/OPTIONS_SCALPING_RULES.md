# Options Scalping System — Architecture Rules &amp; Design

> **North-star design for the Layer 10 Execution Engine (Hot Path)**
> This doc specifies the optional **hot-path upgrade** (Phase G). The default Event Pipeline (candle-close, lag-acceptable)
> is already built and operational. Build this hot path **only if** forward testing proves the Event Pipeline too slow.
> See [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md) §9 for the decision framework.

---

## Table of Contents

1. [Golden Rules](#1-golden-rules)
2. [Architecture: Hot Path vs Cold Path](#2-architecture-hot-path-vs-cold-path)
3. [Signal Sources — What Triggers a Trade](#3-signal-sources--what-triggers-a-trade)
4. [Module Breakdown](#4-module-breakdown)
5. [Performance Design Decisions](#5-performance-design-decisions)
6. [Order Lifecycle &amp; Safety Guarantees](#6-order-lifecycle--safety-guarantees)
7. [TRADE_MODE: Paper → Shadow → Live](#7-trade_mode-paper--shadow--live)
8. [Compliance &amp; Broker Constraints](#8-compliance--broker-constraints)
9. [Implementation Phases](#9-implementation-phases)
10. [Appendix: Latency Budget](#10-appendix-latency-budget)

---

## 1. Golden Rules

These are non-negotiable. Every module, every config, every PR is reviewed against them.

| # | Rule | Rationale |
|---|------|-----------|
| 1 | **TradingView is bias-only, never the entry trigger** | 2–5s webhook latency kills scalping. TV sets regime (trend direction, "longs only today"). Entry is computed in-process from direct Kite ticks. |
| 2 | **The hot path bypasses Kafka** | Kafka stays for journaling, dashboards, Telegram — but the scalper process subscribes directly to the Kite WebSocket and publishes to Kafka *after* the order is on its way. |
| 3 | **Every order has a unique `ordertag`** | Idempotency key — retries never double-fire. Format: `scalp_{timestamp_ms}_{counter}`. |
| 4 | **Entry and SL are atomic** | The moment the entry fills, a resting SL-M order goes in. If SL placement fails, the position is market-exited immediately. Never sit naked in a weekly option. |
| 5 | **The broker's order book is the source of truth** | A reconciliation loop polls the broker order book every 2–3 seconds and corrects drift in local state. WebSocket order updates can be missed. |
| 6 | **Risk manager is never bypassed** | Every order request passes through it. Max concurrent positions (start: 1), max trades/day, max daily loss (circuit breaker), no entries after 15:00, forced square-off at 15:15. |
| 7 | **Precompute everything before the signal fires** | ATM strike map, tradingsymbol + symboltoken, order template, auth token — all updated continuously on tick. Signal → `JSON.stringify` → send should be under 1ms of your code. |
| 8 | **Hot path has no synchronous I/O** | No `fs` calls, no heavy JSON parsing of fields you don't use, no `require()` on the tick path. Keep the heap small — GC pauses stay sub-ms. |
| 9 | **Timestamp every stage with `process.hrtime.bigint()`** | Tick received → decision → request sent → broker ack → fill. Push to journal. Grafana panel shows p50/p99 per stage. |
| 10 | **Deploy in Mumbai (`ap-south-1`)** | Exchanges and broker servers are in Mumbai. EC2 in ap-south-1 gives single-digit ms RTT vs 30–60ms from a home connection. Also escapes home-broadband jitter. |

---

## 2. Architecture: Hot Path vs Cold Path

The key insight: not all data paths are equal. The scalper runs two logical paths.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SCALPER PROCESS (dedicated Node.js)                  │
│                                                                              │
│  ┌───────────────── HOT PATH ─────────────────┐  ┌── COLD PATH ───────────┐ │
│  │                                            │  │                        │ │
│  │  Kite WebSocket ──► In-Memory State        │  │  Kafka Producer       │ │
│  │       │            ├─ Spot LTP             │  │  ├─ Trade journal     │ │
│  │       │            ├─ ATM strike map       │  │  ├─ P&L updates       │ │
│  │       │            ├─ 1m candles (last 5)  │  │  ├─ Fill events       │ │
│  │       │            ├─ VWAP                 │  │  └─ Rejection logs    │ │
│  │       │            └─ EMAs                 │  │                        │ │
│  │       ▼                                     │  │  TimescaleDB         │ │
│  │  Strategy Engine (confluence check)         │  │  ├─ trades table     │ │
│  │       │                                     │  │  ├─ order_log table  │ │
│  │       ▼                                     │  │  └─ pnl_snapshots    │ │
│  │  Risk Manager (gate)                        │  │                        │ │
│  │       │                                     │  │  Telegram Bot        │ │
│  │       ▼                                     │  │  ├─ /kill command    │ │
│  │  OMS (broker API call)                      │  │  ├─ trade alerts     │ │
│  │       │                                     │  │  └─ daily summary    │ │
│  │       ▼                                     │  │                        │ │
│  │  Broker WebSocket (fill confirm)            │  │  Redis               │ │
│  │                                            │  │  ├─ kill-switch flag │ │
│  └────────────────────────────────────────────┘  │  ├─ active positions  │ │
│                                                  │  └─ daily stats       │ │
│  TradingView MCP ──► Regime/Bias (HTTP poll      └────────────────────────┘ │
│                       or webhook, not time-                                 │
│                       critical)                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Hot path requirements
- **Latency budget:** tick → decision → order sent: **&lt;50ms**
- **No Kafka, no DB queries, no HTTP to non-broker endpoints**
- **Dedicated process** — never co-located with dashboard, API, or other layers
- **Persistent broker connection** — keep-alive every 20s during market hours

### Cold path requirements
- Kafka topic: `execution-events` (journal, dashboards, Telegram)
- TimescaleDB: `trades`, `order_log`, `pnl_snapshots` hypertables
- Redis: `kill-switch` flag (checked on every entry attempt), `daily-stats`, `active-positions`
- Telegram: async notification, never on the hot path

---

## 3. Signal Sources — What Triggers a Trade

| Source | Role | Latency Requirement | How It Connects |
|--------|------|-------------------|-----------------|
| **Kite ticks (direct WebSocket)** | Entry trigger. Compute VWAP, EMA, candle breakout in-process | Real-time, every tick | Direct WS to Kite |
| **TradingView MCP** | Regime/bias (trend direction, volatility regime) | Seconds OK | MCP tools or webhook → Kafka `trade-regime` topic |
| **Layer 4 Analysis (Go)** | Confluence filter — indicator state (RSI, MACD) | Sub-second | Kafka `analysis-updates` topic (cold path check) |
| **TradingView Alerts (webhook)** | Discretionary signal ("long Nifty above VWAP") | 2–5s (bias only) | Layer 7 endpoint → Kafka `trade-signals` |
| **Telegram /manual** | Kill switch, emergency square-off | Immediate | Redis kill-switch flag |

### Confluence rule
Entry fires **only** when:
1. Tick-derived strategy engine says entry (e.g. "price > VWAP + buffer on 1m breakout")
2. TradingView regime is aligned (e.g. "only take longs")
3. Layer 4 indicators do not contradict (e.g. RSI &lt; 70 — not overbought)

If TV or Layer 4 data is stale (&gt;30s), skip the trade — don't use stale data.

---

## 4. Module Breakdown

```
layer-10-execution/
├── src/
│   ├── index.js                    # Entry point: init WS, Kafka, Redis, HTTP health
│   ├── config/
│   │   ├── index.js                # Env-based config with defaults
│   │   └── instruments.js          # Nifty/BankNifty ATM strike map (continuous update)
│   ├── scalper/
│   │   ├── kite-ws.js              # Direct Kite WebSocket (hot path tick source)
│   │   ├── memory-state.js         # In-process state: spot, candles, VWAP, EMAs
│   │   └── strategy-engine.js      # Entry/exit rules on 1m data
│   ├── signal/
│   │   ├── regime-consumer.js      # Kafka consumer for TradingView regime
│   │   ├── webhook-handler.js      # TradingView alert webhook consumer
│   │   └── confluence-check.js     # Multi-source confluence filter
│   ├── strike-selector/
│   │   ├── index.js                # Spot → strike resolution
│   │   ├── expiry-rules.js         # Weekly expiry roll logic
│   │   ├── liquidity-gate.js       # Bid-ask spread & OI threshold check
│   │   └── script-master-cache.js  # In-memory instrument → token map
│   ├── strategy/
│   │   ├── scalping-rules.js       # Entry/exit parameter set
│   │   └── trailing-sl.js          # SL modification logic
│   ├── risk/
│   │   ├── manager.js              # Position limits, daily circuit breaker
│   │   ├── kill-switch.js          # Redis-based /kill flag
│   │   └── position-sizing.js      # Lot size from capital-at-risk
│   ├── oms/
│   │   ├── base-executor.js        # Abstract order executor interface
│   │   ├── mstock-executor.js      # MStock Type-B JSON API adapter
│   │   └── flattrade-executor.js   # FlatTrade API adapter
│   ├── position-manager/
│   │   ├── index.js                # Position lifecycle: open → monitor → close
│   │   ├── sl-manager.js           # SL-M order placement & modification
│   │   ├── time-exit.js            # Time-based square-off (N min stall, 15:15 hard stop)
│   │   └── pnl-tracker.js          # Realised/unrealised P&L
│   ├── broker/
│   │   ├── ws-client.js            # Broker order-update WebSocket
│   │   └── reconcile-loop.js       # Poll broker order book every 2-3s
│   ├── journal/
│   │   ├── kafka-producer.js       # Async publisher to execution-events topic
│   │   ├── timescale-writer.js     # Batch writer to trades/order_log hypertables
│   │   └── pnlsnap.js              # P&L snapshot every 30s during active trade
│   ├── telegram/
│   │   └── bot.js                  # Telegram notifications + /kill command handler
│   └── utils/
│       ├── latency-timer.js        # process.hrtime.bigint() stage timing
│       └── retry.js                # Idempotent retry with ordertag
├── config/
│   └── default.json                # Default trade parameters
├── Dockerfile                      # Node 20 alpine, undici, no dev deps
├── package.json
└── tests/
    ├── unit/
    └── integration/
```

---

## 5. Performance Design Decisions

### 5.1 Network & Deployment

| Decision | Why |
|----------|-----|
| **Deploy on EC2 `ap-south-1` (Mumbai)** | Single-digit ms RTT to broker servers vs 30–60ms from home broadband |
| **Use `undici` with persistent connection pool** | `undici` is faster than `node-fetch` or `axios`. Keep connections warm with a funds/order-book poll every 20s during market hours. TLS handshake elimination saves 100–300ms per request. |
| **Direct Kite WebSocket (not via Kafka L1)** | Kafka batching + consumer polling adds 10–100ms. The scalper opens its own WS connection to Kite for the hot path. L1's Kafka pipeline still runs for dashboard/analysis. |

### 5.2 Precomputation

| What | When | How |
|------|------|-----|
| ATM strike map | Every Kite tick | `round(spot / strikeInterval) * strikeInterval` on every tick update. Map stays in memory — zero lookup on signal. |
| Tradingsymbol + symboltoken | On strike map update | Already resolved from script master (loaded at startup) — just a Map lookup. |
| Order payload template | On startup + strike change | Pre-built JSON body for MStock/FlatTrade with `[QUANTITY]` and `[PRICE]` placeholders — stamp and send. |
| Auth token | Refresh every 30 min on timer | Never refresh on-demand. Token expiry = trade skip. |
| 1m candle builder | Every tick | Lightweight in-memory builder (open/high/low/close/volume + timestamp). Keep last 5 candles max. |

### 5.3 Order Types

| Situation | Order Type | Why |
|-----------|-----------|-----|
| Entry | **Marketable limit** (LIMIT at ask + 0.5–1pt, IOC) | Cuts slippage vs MARKET. IOC means no lingering unfilled orders. |
| Stop-loss | **SL-M** (resting at broker) | Executes even if your server crashes. |
| Trailing | **Modify** the resting SL-M (one API call) | Never cancel-and-replace — that creates a naked window. |
| Time-stop / forced square-off | **MARKET** | Speed matters more than slippage when closing. |
| Emergency (/kill) | **MARKET** on all positions | Immediate — ignores slippage. |

### 5.4 Node.js Hygiene

| Rule | Detail |
|------|--------|
| **Dedicated process** | Never inside the dashboard/API process. Zero shared state. |
| **No sync I/O on hot path** | No `fs.readFileSync`, no `JSON.parse` of large objects, no `require()` |
| **Minimal heap** | Parse only fields you need from tick binary. Keep memory under 100MB. |
| **GC tuning** | `--max-old-space-size=256` — small heap means sub-ms GC pauses |
| **Fill confirm via WebSocket** | Broker order-update WS for fills. Polling is backup only (reconcile loop every 2–3s). |

### 5.5 Latency Budget

```
Stage                              Target (p50)    Target (p99)
──────────────────────────────────────────────────────────────
Kite WS tick → memory state        <1ms            <2ms
Strategy decision                  <1ms            <2ms
Risk gate check                    <0.5ms          <1ms
OMS: JSON.stringify + send         <1ms            <2ms
Broker network RTT (Mumbai EC2)    <5ms            <15ms
Broker processing (their server)   50-100ms        300ms
WS fill notification back          50-100ms        200ms
──────────────────────────────────────────────────────────────
Tick → fill (total)                100-200ms       ~500ms
```

The floor is dominated by the broker's own processing — you are not competing with colocated HFT. The game is **consistently** fast (no 2-second outliers) and controlling slippage.

---

## 6. Order Lifecycle & Safety Guarantees

```
1. SIGNAL FIRES (tick-based strategy or TV confluence)
       │
2. RISK GATE
   ├─ Max positions check
   ├─ Daily trade count check
   ├─ Daily loss circuit breaker (Redis kill-switch)
   ├─ Time check (before 15:00?)
   ├─ Confluence check (TV bias aligned? L4 not contradicting?)
   └─ Pre-approval: ALL_GREEN
       │
3. STRIKE SELECTOR
   ├─ Round spot → nearest strike
   ├─ Pick ATM (or ITM-1 for better delta)
   ├─ Role: current weekly expiry (afternoon rule: roll to next)
   └─ Liquidity gate: spread < 0.5% of premium? OI > threshold?
       │
4. OMS: PLACE ENTRY (marketable limit, IOC)
   ├─ ordertag: scalp_1712345678001_0
   └─ On fill (from broker WS):
       ├─ Record fill price, timestamp, ordertag
       ├─ PLACE SL-M order immediately
       │   ├─ Success → position is protected
       │   └─ Fail → MARKET EXIT immediately (never naked)
       └─ Update position manager
       │
5. POSITION MONITORING (every tick of the held option)
   ├─ Track LTP
   ├─ RATCHET trailing SL (modify broker SL-M order, not cancel-replace)
   ├─ Check time-stop (if position open > N minutes with no progress → exit)
   └─ Check target hit
       │
6. EXIT
   ├─ SL hit → broker handles (resting SL-M), confirm via WS
   ├─ Target hit → place marketable limit sell
   ├─ Time-stop hit → MARKET sell
   ├─ 15:15 hard stop → MARKET sell everything
   └─ /kill command → MARKET sell everything
       │
7. JOURNAL (async, never on hot path)
   ├─ Kafka: execution-events topic
   ├─ TimescaleDB: trades, order_log
   └─ Telegram: trade summary
```

### Retry rules
- **Entry:** retry up to 2x with same `ordertag` (broker dedupes). After 2 failures → skip trade.
- **SL placement:** retry up to 3x. After 3 failures → MARKET exit position.
- **SL modification (trailing):** best-effort. If it fails, the old SL stays — position is still protected.
- **Exit:** retry up to 3x. After 3 failures → escalate to Telegram alert.

---

## 7. TRADE_MODE: Paper → Shadow → Live

Controlled by a single env var `TRADE_MODE` with three values. No code changes between modes — just restart with a different env.

### Paper Mode (`TRADE_MODE=paper`)

| What | How |
|------|-----|
| Entry trigger | Full pipeline runs — strategy, risk gate, strike selector all execute normally |
| Order placement | Simulated. OMS returns "simulated fill at ask + 1 tick" instead of calling broker API |
| Fill confirm | Immediate (simulated). No broker WebSocket needed. |
| SL | Simulated SL-M at fixed percentage below simulated fill |
| Position tracking | Same position manager code, but against simulated prices |
| P&L | Calculated against live LTP. Shows exactly what would have happened, including slippage estimate |
| Journal | Full journaling to TimescaleDB and Kafka — identical to live |
| Duration | **Minimum 2 weeks** — scalping edge is mostly eaten by slippage and spread, and paper mode is how you find out before real money does |

### Shadow Mode (`TRADE_MODE=shadow`)

| What | How |
|------|-----|
| Entry trigger | Full pipeline runs. Entry is **NOT** sent to broker |
| Telegram alert | Sends you: "Would enter LONG NIFTY 25JAN25100CE @ ₹85, SL @ ₹68" |
| Manual action | You decide whether to fire the order manually |
| Purpose | Validate the strategy against your own discretion for 1–2 weeks before trusting it fully |
| Journal | Full journaling — marks entries as "shadow" so you can review accuracy later |

### Live Mode (`TRADE_MODE=live`)

| What | How |
|------|-----|
| Entry | Full pipeline executes orders on the broker |
| Position sizing | Start at **1 lot**. Increase only after 20+ trades with positive expectancy |
| Safety | All risk manager rules active. Telegram /kill powered up. |
| Duration | Run 1 lot for 20–30 trades minimum before considering size increase |

---

## 8. Compliance & Broker Constraints

### SEBI Retail Algo Framework
- Broker-side registration/tagging is required for automated order flow
- Verify with MStock support before going live: do they support API-based algo tagging, or do you need a separate approval?
- If required: add a registration step in the onboarding that sets the correct headers

### MStock API Constraints (from Postman collection)
- **Base URL:** `https://typeb-api.mstock.com`
- **Product type:** `INTRADAY` for equity F&O scalping
- **Exchange:** `NFO` for Nifty/BankNifty options
- **Rate limits:** Confirm with MStock support. Scalping order frequency (multiple orders per minute) can trip standard API rate limits. Have a throttling mechanism ready.
- **Order WebSocket:** Verify MStock provides order-update WebSocket (not just tick WebSocket). If not, polling + reconcile loop becomes critical.

### FlatTrade API Constraints
- Similar rate limit verification needed
- Order-update WebSocket availability

---

## 9. Implementation Status — Hot Path (Phase G, Optional Upgrade)

> **The default Event Pipeline is already built** (Phases A–E). This section specifies the **optional hot-path upgrade**
> for T1 scalp. Build this only if forward testing shows the Event Pipeline is consistently late on the fastest 1m bursts.

**Current build status of the default system** (see [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md) §10):

| Component | Build Status | Location |
|-----------|-------------|----------|
| L10 config (TRADE_MODE, broker, thresholds) | ✅ Built | `layer-10-execution/config/default.js` |
| OMS (FlatTrade + MStock) | ✅ Built | `layer-10-execution/src/oms/` |
| Risk manager + kill switch | ✅ Built | `layer-10-execution/src/risk/manager.js` |
| Position manager (SL, trailing, time stop, square-off) | ✅ Built | `layer-10-execution/src/risk/position-manager.js` |
| Strike selector + expiry rules | ✅ Built | `layer-10-execution/src/strike-selector.js` |
| Trade journal (execution-events, trades, order_log, pnl_snapshots) | ✅ Built | `layer-10-execution/src/trade-journal.js` + migration 005 |
| Paper/shadow/live modes | ✅ Built | `layer-10-execution/src/paper-executor.js` |
| Regime consumer (from Kafka market-regime) | ✅ Built | `layer-6-signal/src/regime/` |

**Hot-path additions needed** (only if Event Pipeline proves too slow):

```
Phase G: Hot-Path Upgrade (T1 only)
  ├── Direct Kite WS connection (bypass Kafka for ticks)
  ├── In-process tick→1m candle builder (memory-state)
  ├── In-process strategy evaluation (no Kafka latency)
  ├── Broker-side resting SL-M from fill moment
  ├── Dual feed failover (Zerodha + FlatTrade) per §11.1
  └── Marketable limit + IOC entry for slippage control
```

### Infrastructure Changes

| File | Change |
|------|--------|
| `docker-compose.app.yml` | Add `execution` service (layer-10-execution) |
| `docker-compose.infra.yml` | Add `KAFKA_CREATE_TOPICS: execution-events, trade-regime, trade-signals` |
| `Makefile` | Add `layer10` target, add execution to `app:` dependencies |
| `.env.example` | Add `TRADE_MODE`, `EXECUTION_BROKER`, `MSTOCK_EXECUTION_*`, `KILL_SWITCH_REDIS_KEY` |
| `layer-3-storage/timescaledb/migrations/` | Add `005_execution_schema.sql` |

---

## 10. Appendix: Latency Budget

### Stage Breakdown (p50)

| Stage | Time | Cumulative | Notes |
|-------|------|-----------|-------|
| Kite WS → tick parsed | 0.5ms | 0.5ms | Parse only LTP, token, timestamp |
| Memory state update | 0.1ms | 0.6ms | O(1) Map write |
| Strategy engine check | 0.5ms | 1.1ms | Compare price vs VWAP/EMA, check breakout |
| Risk gate | 0.3ms | 1.4ms | Redis GET kill-switch (<1ms), in-memory counters |
| Strike + payload build | 0.2ms | 1.6ms | Precomputed — just stamp quantity |
| HTTP send (undici) | 3ms | 4.6ms | Persistent connection, no DNS/TLS |
| Broker processing | 75ms | 79.6ms | This is the floor — their match engine |
| WS fill notification | 60ms | 139.6ms | Broker sends fill event via their WS |
| SL-M placement | 5ms | 144.6ms | Separate API call, persistent connection |

### How It Deteriorates (and How to Prevent)

| Problem | Impact | Fix |
|---------|--------|-----|
| Cold TLS handshake | +100-300ms | Keep-alive poll every 20s |
| Kafka producer flush on hot path | +20-50ms | Async producer — fire and forget on hot path |
| GC pause | +2-10ms | Small heap (--max-old-space-size=256), no temp objects on hot path |
| DNS resolution | +20-100ms | Pre-resolve and cache at startup |
| Home broadband jitter | +10-100ms | Deploy on EC2 ap-south-1 |
| Broker rate-limit 429 | +1000ms+ | Throttle: max 3 orders per 2 seconds. Queue if exceeded. |
| Order book polling | +100-500ms | Use WS for fills, polling only as reconcile backup (every 2-3s) |

---

## Decision Record

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-04 | TradingView is bias-only, not entry trigger | 2-5s webhook latency kills scalping |
| 2026-07-04 | Hot path bypasses Kafka | Kafka adds 10-100ms via batching + polling |
| 2026-07-04 | Direct Kite WS for ticks | Avoid L1 Kafka pipeline latency |
| 2026-07-04 | Marketable limit orders for entry | Cuts slippage vs MARKET; IOC prevents lingering |
| 2026-07-04 | Broker-side SL-M from fill moment | Protects against server crash |
| 2026-07-04 | undici over axios/node-fetch | ~30% faster HTTP, persistent pool |
| 2026-07-04 | EC2 ap-south-1 deployment | Single-digit ms RTT to brokers |
| 2026-07-04 | TRADE_MODE=paper/shadow/live | Zero code changes between modes |
| 2026-07-04 | ordertag for idempotency | Prevents double-fill on retry |

---

> **Build status:** Layer 10 execution engine is **built** (Phase E). See `layer-10-execution/src/` and [`PROJECT_STATE.md`](../PROJECT_STATE.md). The hot path specified below is the **optional Phase G upgrade** — default is the Event Pipeline (lag acceptable, candle-close signals).
