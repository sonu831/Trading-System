# 🔄 Layer 2: Data Processing

**Technology:** Node.js + Kafka Consumers  
**Latency:** ~5ms  
**Responsibility:** Transform raw ticks into OHLCV candles

---

## 📋 Overview

The Data Processing Layer consumes raw ticks from Kafka and builds real-time OHLCV (Open, High, Low, Close, Volume) candles. It handles:

- 1-minute, 5-minute, and 15-minute candle timeframes
- Out-of-order tick handling with watermarking
- VWAP calculation
- Volume aggregation

## 🏗️ Architecture

```
Kafka Topic: raw-ticks (50 partitions)
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    │         │         │         │         │
    ▼         ▼         ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐
│ C1    │ │ C2    │ │ C3    │ │ C4    │ │ C5    │
│10 stk │ │10 stk │ │10 stk │ │10 stk │ │10 stk │
└───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘
    │         │         │         │         │
    │         │         │         │         │
    └─────────┴─────────┴─────────┴─────────┘
                        │
                        ▼
          ┌─────────────────────────┐
          │     Candle Builder      │
          │  ┌───────────────────┐  │
          │  │ 1-minute windows  │  │
          │  └───────────────────┘  │
          │  ┌───────────────────┐  │
          │  │ OHLCV Aggregation │  │
          │  └───────────────────┘  │
          │  ┌───────────────────┐  │
          │  │ VWAP Calculation  │  │
          │  └───────────────────┘  │
          └────────────┬────────────┘
                       │
              ┌────────┴────────┐
              ▼                 ▼
        ┌─────────┐      ┌───────────┐
        │  Redis  │      │TimescaleDB│
        │ (Live)  │      │ (History) │
        └─────────┘      └───────────┘
```

## 📁 Directory Structure

```
layer-2-processing/
├── README.md
├── package.json
├── Dockerfile
│
├── src/
│   ├── index.js              # Entry point
│   │
│   ├── consumers/
│   │   ├── tickConsumer.js   # Kafka consumer
│   │   └── consumerGroup.js  # Consumer group management
│   │
│   ├── candle-builder/
│   │   ├── index.js          # Main candle builder
│   │   ├── window.js         # Time window management
│   │   └── aggregator.js     # OHLCV aggregation
│   │
│   └── storage/
│       ├── redis.js          # Redis client
│       └── timescale.js      # TimescaleDB client
│
└── config/
    └── default.json
```

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Start service
npm start
```

## 📊 Candle Schema

```javascript
{
  symbol: "RELIANCE",
  exchange: "NSE",
  timeframe: "1m",
  timestamp: 1705487400000,  // Candle open time
  open: 2445.00,
  high: 2460.00,
  low: 2440.00,
  close: 2456.75,
  volume: 1234567,
  vwap: 2452.30,
  trades: 5678
}
```

## ⚙️ Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `KAFKA_BROKERS` | Kafka brokers | localhost:9092 |
| `KAFKA_CONSUMER_GROUP` | Consumer group ID | processing-group |
| `REDIS_URL` | Redis connection | redis://localhost:6379 |
| `TIMESCALE_URL` | TimescaleDB URL | postgresql://... |

## 📈 Metrics

- `processing_candles_built_total` - Candles built
- `processing_ticks_consumed_total` - Ticks consumed
- `processing_lag_seconds` - Consumer lag

---

**Previous:** [Layer 1 - Ingestion](../layer-1-ingestion/README.md)  
**Next:** [Layer 3 - Storage](../layer-3-storage/README.md)
