# Layer 2: Data Processing Service

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview

Layer 2 is the **processing engine** that consumes market data from Kafka, validates it, and persists it to TimescaleDB. It also maintains a Redis hot cache for real-time dashboard updates.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Layer 2: Processing                         │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌────────────┐    ┌─────────────┐              │
│  │  Kafka  │───▶│  Consumer  │───▶│ TimescaleDB │              │
│  │Consumer │    │  Handler   │    │ (candles_1m)│              │
│  └─────────┘    └─────┬──────┘    └─────────────┘              │
│                       │                                         │
│                       ▼                                         │
│              ┌─────────────┐                                    │
│              │    Redis    │ (Hot Cache: ltp:{symbol})         │
│              └─────────────┘                                    │
└────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component     | Technology               |
| ------------- | ------------------------ |
| Runtime       | Node.js 18+              |
| Message Queue | KafkaJS (Consumer)       |
| Database      | TimescaleDB (PostgreSQL) |
| Cache         | Redis                    |
| Metrics       | prom-client (Prometheus) |

## Key Features

- **Kafka Consumer**: Subscribes to `market_data_feed` topic
- **TimescaleDB Persistence**: Inserts into `candles_1m` hypertable
- **Redis Hot Cache**: Caches latest price (`ltp:{symbol}`) and candles
- **Prometheus Metrics**: Tracks candles processed, latency histogram
- **Graceful Shutdown**: Properly disconnects from all services

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Running Kafka, Redis, and TimescaleDB

### Option 1: Using Makefile (Recommended)

```bash
# From project root
make infra          # Start Kafka, Redis, TimescaleDB
make layer2         # Start Layer 2 in dev mode
```

### Option 2: Local Development

```bash
# 1. Install dependencies
cd layer-2-processing
npm install

# 2. Configure Environment (if needed)
# Environment variables are in .env

# 3. Start in development mode
npm run dev
```

### Option 3: Docker

```bash
# From project root
docker-compose up -d processing
```

## 🔧 Configuration

### Environment Variables

Located in `layer-2-processing/.env`:

| Variable        | Description                  | Default                                                  |
| --------------- | ---------------------------- | -------------------------------------------------------- |
| `TIMESCALE_URL` | PostgreSQL connection string | `postgresql://trading:trading123@localhost:5432/nifty50` |
| `KAFKA_BROKERS` | Kafka broker addresses       | `localhost:9092`                                         |
| `KAFKA_TOPIC`   | Topic to consume             | `market_data_feed`                                       |
| `REDIS_URL`     | Redis connection URL         | `redis://localhost:6379`                                 |
| `PORT`          | Health/Metrics port          | `3002`                                                   |

### Expected Message Format

Layer 2 expects messages from Kafka in this format:

```json
{
  "type": "historical_candle",
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "timestamp": "2026-01-17 09:15",
  "open": 1475.3,
  "high": 1477.9,
  "low": 1470.0,
  "close": 1470.5,
  "volume": 121840
}
```

## 📈 Prometheus Metrics

Access at: `http://localhost:3002/metrics`

| Metric                              | Type      | Description                       |
| ----------------------------------- | --------- | --------------------------------- |
| `candles_processed_total`           | Counter   | Total candles processed by symbol |
| `candle_processing_latency_seconds` | Histogram | Processing time per candle        |
| `process_*`                         | Gauge     | Node.js process metrics           |
| `nodejs_*`                          | Gauge     | Node.js runtime metrics           |

### Sample Output

```
candles_processed_total{symbol="RELIANCE"} 2250
candle_processing_latency_seconds_sum 1.57
candle_processing_latency_seconds_count 2250
```

## 💾 Database Schema

Layer 2 persists data to the `candles_1m` hypertable:

```sql
CREATE TABLE candles_1m (
    time        TIMESTAMPTZ NOT NULL,
    symbol      TEXT NOT NULL,
    exchange    TEXT NOT NULL DEFAULT 'NSE',
    open        DOUBLE PRECISION,
    high        DOUBLE PRECISION,
    low         DOUBLE PRECISION,
    close       DOUBLE PRECISION,
    volume      BIGINT
);

-- TimescaleDB Hypertable
SELECT create_hypertable('candles_1m', 'time');
```

### Query Examples

```sql
-- Count candles per symbol
SELECT symbol, COUNT(*) FROM candles_1m GROUP BY symbol;

-- Latest 5 candles for RELIANCE
SELECT * FROM candles_1m
WHERE symbol = 'RELIANCE'
ORDER BY time DESC LIMIT 5;

-- Volume weighted average price (VWAP)
SELECT symbol,
       SUM(close * volume) / SUM(volume) as vwap
FROM candles_1m
WHERE time > NOW() - INTERVAL '1 day'
GROUP BY symbol;
```

## 🔴 Redis Cache

Layer 2 maintains a hot cache for real-time access:

| Key Pattern          | TTL  | Value                                                 |
| -------------------- | ---- | ----------------------------------------------------- |
| `ltp:{symbol}`       | 60s  | `{"price": 1470.50, "time": "...", "volume": 121840}` |
| `candle:{symbol}:1m` | 120s | Full candle JSON                                      |

### Query Redis Cache

```bash
# Check latest price
docker exec redis redis-cli GET ltp:RELIANCE

# Check latest candle
docker exec redis redis-cli GET candle:RELIANCE:1m
```

## 📁 Directory Structure

```
layer-2-processing/
├── src/
│   ├── index.js           # Main entry point
│   ├── db/
│   │   └── client.js      # TimescaleDB connection pool
│   ├── kafka/
│   │   └── consumer.js    # Kafka consumer setup
│   └── services/
│       ├── candle-writer.js  # DB insert logic
│       └── redis-cache.js    # Redis caching
├── .env                   # Environment variables
└── package.json
```

## 🔍 Troubleshooting

### Common Issues

**1. "ENOTFOUND timescaledb" error**

- TimescaleDB container is not running
- Run: `docker-compose up -d timescaledb`

**2. "getaddrinfo ENOTFOUND" for Kafka**

- Kafka container is not ready
- Wait 30 seconds after starting Kafka before running Layer 2

**3. "0 candles in database" after feed**

- Consumer started AFTER messages were produced
- Set `fromBeginning: true` in consumer config (already done)
- Or re-run `make feed` to send new messages

**4. Timestamps show "1970-01-01"**

- Timestamp parsing issue in feed script
- Ensure timestamps are in ISO format or "YYYY-MM-DD HH:mm"

## 🏥 Health Check

```bash
# Check service health
curl http://localhost:3002/health

# Expected response:
{
  "status": "healthy",
  "service": "layer-2-processing",
  "timestamp": "2026-01-18T10:30:00.000Z"
}
```

## Authors

- **Yogendra Singh**
