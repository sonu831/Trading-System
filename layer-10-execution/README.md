# Layer 10 — Execution (Order Gateway)

> **One job:** Receive trade signals, risk-gate them, resolve strikes, place broker orders, manage positions with resting SL-M.
> **Tech:** Node.js 20 · **Port:** 8095 · **Modes:** paper → shadow → live

## Architecture

```
trade-signals (Kafka)
    │
    ▼
Risk Gate → Strike Selector → OMS → Position Manager → Trade Journal
    │           │               │          │
    │    (kill switch,      (FlatTrade   (SL-M rest,
    │     limits, daily     primary,     trailing,
    │     cutoff)           MStock/Kite  time-stop)
    │                       failover)
    ▼
reject/allow          resolve symbol   place/modify/cancel
```

## Files

| File | Purpose |
|------|---------|
| `src/index.js` | Main entry: Kafka consumer, Redis, Express API (/health, /state, /kill, /resume) |
| `src/live-executor.js` | LiveExecutor: real broker orders, SL-M atomic, fill confirmation |
| `src/paper-executor.js` | PaperExecutor: synthetic fills for simulation |
| `src/oms/base.js` | Abstract OMS: `placeOrder(), cancelOrder(), getQuote()` |
| `src/oms/flattrade.js` | FlatTrade adapter (PiConnect API) — primary executor |
| `src/oms/mstock.js` | MStock adapter (Type B) — fail-closed (no SL-M support yet) |
| `src/risk/manager.js` | Risk gates: kill switch, max concurrent, daily loss, entry cutoff |
| `src/risk/position-manager.js` | Tracks open positions: SL, trailing, time-stop, P&L |
| `src/strike-selector.js` | Spot → NFO symbol resolution (ATM/ITM-1, weekly expiry) |
| `src/trade-journal.js` | TimescaleDB writes: trades, order_log, pnl_snapshots |

## Safety Invariants

1. **Only BUY premium** — CE for LONG, PE for SHORT
2. **Entry + SL atomic** — fill → SL-M placed. SL fails → emergency flatten
3. **Broker is source of truth** — `_awaitFill()` confirms broker fill
4. **Unique ordertag** — crypto-random, prevents double-fire
5. **Kill switch persisted** — Redis `execution:kill_switch` survives restart
6. **Live fails closed** — `LIVE_TRADING_ARMED` + OMS capability probe

## Run

```bash
make layer10            # Local dev
make docker-execution   # Docker
cd layer-10-execution && npm run verify  # 35 tests
```
