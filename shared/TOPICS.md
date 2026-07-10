# Kafka Topics — Contract Reference

## Existing Topics
| Topic | Producer | Consumer(s) | Payload |
|-------|----------|-------------|---------|
| `raw-ticks` | L1 Ingestion | L2 Processing | `{symbol, exchange, timestamp, ltp, ltq, volume, bid, ask, open, high, low, close, buyQuantity, sellQuantity, instrumentType?}` |
| `notifications` | Any layer | L8 Telegram | `{id, type, channel, payload, timestamp, retryCount}` |
| `notifications-dlq` | L8 NotificationConsumer | Manual DLQ | Failed notification + error context |

## New Topics (Momentum Module)

### `option-chain` (Phase A)
- **Producer**: L1 OptionChainPoller
- **Consumers**: L4 (analysis), L6 (signal), L10 (execution)
- **Payload**:
```json
{
  "time": "ISO8601",
  "underlying": "NIFTY|BANKNIFTY",
  "spot": 18500.50,
  "expiry": "2024-07-11",
  "atmStrike": 18500,
  "options": [
    {
      "symbol": "NIFTY24J1118500CE",
      "strike": 18500,
      "option_type": "CE",
      "ltp": 120.50,
      "bid": 119.00,
      "ask": 122.00,
      "open_interest": 500000,
      "volume": 2500,
      "iv": 14.5
    }
  ]
}
```

### `market-regime` (Phase B)
- **Producer**: L6 Regime Engine
- **Consumers**: L6 Router, L7, L8, L10
- **Payload**: `RegimeState` — see MOMENTUM_TRADING_ARCHITECTURE.md §3.9

### `trade-signals` (Phase C — extended)
- **Producer**: L6 Strategy Framework
- **Consumers**: L10 Execution
- **Extended fields**: `tier`, `strategyId`, `regime`, `breadth_snapshot`, `strike_hint`, `reasons[]`

### `execution-events` (Phase E)
- **Producer**: L10 Execution
- **Consumers**: L7, L8, Storage
- **Payload**: fills, rejects, exits, P&L, feed-failover events

## Schema location
All JSON schemas are embedded in producer/consumer code. If schemas grow complex, extract to `shared/schemas/`.
