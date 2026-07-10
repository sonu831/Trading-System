# Layer 2 — Processing (Tick → Candle Builder)

> **One job:** Consume raw ticks from Kafka, build 1-minute OHLCV candles, write to TimescaleDB, cache in Redis.
> **Tech:** Node.js 20 · **Port:** 3002

## Architecture

```
raw-ticks (Kafka) → CandleAggregator → 1m OHLCV → TimescaleDB (candles_1m)
                         │                         │
                         └── Redis (ltp, candle) ──┘
                    OptionChainWriter → options_chain (TimescaleDB)
```

## Files

| File | Purpose |
|------|---------|
| `src/services/candleAggregator.js` | Tick → 1m OHLCV, checkBoundaries() flushes on minute boundary |
| `src/services/candleWriter.js` | `INSERT INTO candles_1m ON CONFLICT DO NOTHING` |
| `src/services/redisCache.js` | `ltp:{symbol}` (60s TTL), `candle:{symbol}:1m` (120s TTL) |
| `src/services/optionChainWriter.js` | Consumes `option-chain` topic → writes options_chain hypertable |
| `src/services/bounded-queue.js` | Max 5000 ticks, drop policy, backpressure flag |
| `src/kafka/consumer.js` | Manual commits, versioned group (v4) |
| `src/kafka/optionChainConsumer.js` | Dedicated option chain consumer |

## Key Constants

```js
const { KAFKA_TOPICS, KAFKA_GROUPS, REDIS_KEYS } = require('/app/shared');
// KAFKA_TOPICS.RAW_TICKS → 'raw-ticks'
// KAFKA_GROUPS.L2_PROCESSING → 'layer-2-processing-group-v4'
```

## Run

```bash
make layer2          # Local dev
npm test             # 4 candle aggregator tests
```
