# shared/ — Single Source of Truth

> **Every constant, type, enum, and interface used across layers lives here.**
> One import for everything. Never re-declare in individual layers.

## Quick Import

```js
// Node.js (CommonJS — one line)
const { KAFKA_TOPICS, PORTS, REGIME_TREND, REDIS_KEYS } = require('/app/shared');
```

```ts
// TypeScript
import { KAFKA_TOPICS, PORTS, type TradeSignal, type Position } from '@shared';
```

```go
// Go
import shared "github.com/utkarsh-pandey/nifty50-trading-system/shared"
```

## Files

| File | Content | Import by |
|-------|---------|-----------|
| `index.js` | **CommonJS barrel** — one `require('/app/shared')` | All Node.js layers |
| `index.ts` | TypeScript barrel — one `import from '@shared'` | Dashboard |
| `types.ts` | 25 interfaces: TradeSignal, Position, RegimeState, ChainRow, ExecutionState, Loaded\<T\> | L8, L7 |
| `ports.ts` | 9 interfaces: ExecutionPort, MarketPort, OptionsPort, ProviderPort | L8 |
| `constants.js` | All runtime constants (see below) | All Node.js |
| `constants.go` | Go mirror | L4, L5 |
| `health-check/` | Kafka, Redis, TimescaleDB health checks | L1, L2, L7 |
| `kafka/` | Notification producer/consumer | L8 |

## Constants Reference

### Kafka Topics (KAFKA_TOPICS)
| Key | Value |
|-----|-------|
| `RAW_TICKS` | `'raw-ticks'` |
| `MARKET_CANDLES` | `'market_candles'` |
| `TRADE_SIGNALS` | `'trade-signals'` |
| `OPTION_CHAIN` | `'option-chain'` |
| `MARKET_REGIME` | `'market-regime'` |
| `EXECUTION_EVENTS` | `'execution-events'` |
| `NOTIFICATIONS` | `'notifications'` |
| `ALT_DATA` | `'alt-data'` |
| `ANALYSIS_UPDATES` | `'analysis_updates'` |
| `SENTIMENT_SCORES` | `'sentiment_scores'` |
| `MARKET_DATA` | `'market-data'` |

### Consumer Groups (KAFKA_GROUPS)
| Key | Value |
|-----|-------|
| `L2_PROCESSING` | `'layer-2-processing-group-v4'` |
| `L6_SIGNAL` | `'layer-6-signal-group-v1'` |
| `L10_EXECUTION` | `'layer-10-execution-group-v1'` |

### Ports (PORTS)
| Key | Value | Service |
|-----|-------|---------|
| `BACKEND_API` | `4000` | L7 API |
| `EXECUTION` | `8095` | L10 Execution |
| `INGESTION` | `9101` | L1 Ingestion |
| `PROCESSING` | `3002` | L2 Processing |
| `ANALYSIS` | `8081` | L4 Analysis |
| `AGGREGATION` | `8080` | L5 Aggregation |
| `SIGNAL` | `8082` | L6 Signal |
| `DASHBOARD` | `3000` | L8 Dashboard |
| `KAFKA_UI` | `8090` | Kafka UI |
| `PGADMIN` | `5051` | DB Admin |

### Redis Keys (REDIS_KEYS)
```js
REDIS_KEYS.LTP('NIFTY')              // 'ltp:NIFTY'
REDIS_KEYS.CANDLE_LATEST('NIFTY','1m') // 'candle:NIFTY:1m:latest'
REDIS_KEYS.BROKER_SESSION('mstock')   // 'broker:session:mstock'
REDIS_KEYS.MARKET_REGIME_LATEST       // 'market-regime:latest'
```

### Regime
```js
REGIME_TREND.UP      // 'TREND_UP'
REGIME_SENTIMENT.BULLISH  // 'BULLISH'
REGIME_VOLATILITY.HIGH    // 'HIGH'
REGIME_PHASE.TRENDING     // 'TRENDING'
```

### Signals
```js
SIGNAL_DIRECTION.LONG   // 'LONG'
SIGNAL_ACTION.BUY       // 'BUY'
SIGNAL_TIER.T1          // 'T1'
OPTION_TYPE.CE          // 'CE'
```

## Adding a New Constant

1. Add to `shared/constants.js` with JSDoc
2. Add to `shared/constants.go` if Go needs it
3. Add to `shared/index.js` barrel export
4. Import in your layer — never hardcode the string

## Docker Volume Mount Check

| Layer | Mounted? |
|-------|----------|
| L1 Ingestion | ✅ `../../shared:/app/shared:ro` |
| L2 Processing | ✅ |
| L6 Signal | ✅ |
| L7 API | ✅ `../../shared:/app/shared:ro` |
| L8 Dashboard | ✅ `../../shared:/app/shared:ro` |
| L10 Execution | ✅ |
