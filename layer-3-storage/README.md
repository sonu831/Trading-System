# 💾 Layer 3: Data Storage

**Technology:** Redis + TimescaleDB + S3  
**Pattern:** Hot-Warm-Cold Storage  
**Responsibility:** Multi-tier storage for different access patterns

---

## 📋 Overview

The Storage Layer implements a three-tier storage architecture optimized for different access patterns:

| Tier | Technology | Latency | Retention | Purpose |
|------|------------|---------|-----------|---------|
| 🔥 **Hot** | Redis | <1ms | Current | Live state, indicators |
| 📊 **Warm** | TimescaleDB | 1-10ms | 7-30 days | Candle history |
| ❄️ **Cold** | S3/MinIO | Seconds | Years | Backtesting data |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HOT LAYER (Redis)                        │
│                                                             │
│   tick:latest:{symbol}     → Current price                  │
│   candle:current:{symbol}  → In-progress candle             │
│   candle:1m:{symbol}       → Last completed 1m candle       │
│   indicators:{symbol}      → RSI, MACD, EMA, etc.           │
│   breadth:current          → Live market breadth            │
│   signal:active            → Current trading signal         │
│                                                             │
│   Features:                                                 │
│   ├── Pub/Sub for real-time events                         │
│   ├── Cluster mode for HA                                   │
│   └── LRU eviction for memory management                    │
│                                                             │
│   Latency: <1ms | Retention: Current values only            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   WARM LAYER (TimescaleDB)                  │
│                                                             │
│   Tables (Hypertables):                                     │
│   ├── candles_1m    → 1-minute candles                      │
│   ├── candles_5m    → Continuous aggregate                  │
│   ├── candles_15m   → Continuous aggregate                  │
│   ├── options_chain → Options snapshots                     │
│   └── signals       → Generated signals history             │
│                                                             │
│   Features:                                                 │
│   ├── Automatic time partitioning                           │
│   ├── Continuous aggregates (rollups)                       │
│   ├── 90%+ compression                                      │
│   └── Full SQL support                                      │
│                                                             │
│   Latency: 1-10ms | Retention: 7-30 days                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    COLD LAYER (S3/MinIO)                    │
│                                                             │
│   Structure:                                                │
│   s3://trading-data/                                        │
│   ├── candles/                                              │
│   │   └── year=2024/month=01/day=15/                       │
│   │       └── RELIANCE.parquet                             │
│   ├── options/                                              │
│   └── signals/                                              │
│                                                             │
│   Format: Parquet (columnar, compressed)                    │
│   Latency: Seconds | Retention: Years                       │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
layer-3-storage/
├── README.md
│
├── redis/
│   ├── redis.conf            # Redis configuration
│   └── cluster.conf          # Cluster configuration
│
├── timescaledb/
│   └── migrations/
│       ├── 001_create_candles.sql
│       ├── 002_create_continuous_aggs.sql
│       ├── 003_create_options.sql
│       └── 004_create_signals.sql
│
└── scripts/
    ├── init-redis.sh
    ├── init-timescale.sh
    └── archive-to-s3.sh
```

## 🚀 Setup

### Redis

```bash
# Start Redis with Docker
docker run -d --name redis \
  -p 6379:6379 \
  -v ./redis/redis.conf:/usr/local/etc/redis/redis.conf \
  redis:7-alpine redis-server /usr/local/etc/redis/redis.conf
```

### TimescaleDB

```bash
# Start TimescaleDB with Docker
docker run -d --name timescaledb \
  -p 5432:5432 \
  -e POSTGRES_USER=trading \
  -e POSTGRES_PASSWORD=trading123 \
  -e POSTGRES_DB=nifty50 \
  -v timescale-data:/var/lib/postgresql/data \
  timescale/timescaledb:latest-pg15

# Run migrations
psql -h localhost -U trading -d nifty50 -f migrations/001_create_candles.sql
```

## 📊 Redis Key Patterns

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `tick:latest:{symbol}` | Hash | Current tick data |
| `candle:current:{symbol}` | Hash | In-progress candle |
| `candle:1m:{symbol}` | Hash | Last 1m candle |
| `indicators:{symbol}` | Hash | Technical indicators |
| `breadth:current` | Hash | Market breadth |
| `signal:active` | String (JSON) | Active signal |

### Pub/Sub Channels

| Channel | Description |
|---------|-------------|
| `candles:1m` | New 1-minute candles |
| `signals:new` | New trading signals |
| `alerts:telegram` | Telegram notifications |

## 📊 TimescaleDB Schema

### candles_1m Table

```sql
CREATE TABLE candles_1m (
  time        TIMESTAMPTZ NOT NULL,
  symbol      TEXT NOT NULL,
  open        DECIMAL(12,2),
  high        DECIMAL(12,2),
  low         DECIMAL(12,2),
  close       DECIMAL(12,2),
  volume      BIGINT,
  vwap        DECIMAL(12,2),
  trades      INTEGER
);

-- Convert to hypertable
SELECT create_hypertable('candles_1m', 'time');

-- Create index on symbol
CREATE INDEX idx_candles_1m_symbol ON candles_1m (symbol, time DESC);
```

### Continuous Aggregates

```sql
-- 5-minute candles from 1-minute
CREATE MATERIALIZED VIEW candles_5m
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS time,
  symbol,
  first(open, time) AS open,
  max(high) AS high,
  min(low) AS low,
  last(close, time) AS close,
  sum(volume) AS volume
FROM candles_1m
GROUP BY time_bucket('5 minutes', time), symbol;
```

## 📈 Monitoring

- Redis: `redis-cli INFO`
- TimescaleDB: `timescaledb_information.chunks`
- Grafana dashboards included in `/infrastructure/monitoring/`

---

**Previous:** [Layer 2 - Processing](../layer-2-processing/README.md)  
**Next:** [Layer 4 - Analysis](../layer-4-analysis/README.md)
