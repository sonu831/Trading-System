# 🏗️ Nifty 50 Trading System - Architecture Deep Dive

**Version:** 2.0  
**Last Updated:** January 2026  
**Authors:** Yogendra Singh, Utkarsh

---

## 🎨 Interactive Architecture Diagram

> **📊 View the complete architecture in Draw.io:**  
> [**Open Complete Trading System Architecture in Draw.io**](https://viewer.diagrams.net/?tags=%7B%7D&lightbox=1&highlight=0000ff&edit=_blank&layers=1&nav=1&title=Complete-Trading-System-Architecture.drawio&dark=auto#Uhttps%3A%2F%2Fdrive.google.com%2Fuc%3Fid%3D1ZcuS7UO1yRewby3SEUW_asczGtg90zl6%26export%3Ddownload)

---

## 📊 Executive Summary

A comprehensive 7-layer microservices architecture for real-time Nifty 50 stock analysis and trading signals. Built for high throughput, low latency, and extensibility with planned AI/ML integration.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXTERNAL BROKERS: MStock | Flattrade | Zerodha | Batch APIs                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L1: INGESTION (Node.js) - Multi-vendor octopus + Kafka producer            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L2: PROCESSING (Go) - Tick → OHLCV aggregation                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L3: STORAGE - TimescaleDB (hypertables + views) + Redis (hot cache)        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L4: ANALYSIS (Go) - Technical indicators + (Future: AI pattern detection)  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L5: AGGREGATION (Go) - Market breadth + Sector analysis + Composite score  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L6: SIGNAL (Node.js) - Rule engine + (Future: AI decision model)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  L7: PRESENTATION - Dashboard (Next.js) + API (Fastify) + Telegram Bot      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔌 Layer 1: Ingestion

**Technology:** Node.js  
**Port:** 3001  
**Purpose:** Connect to multiple broker APIs and feed normalized ticks to Kafka

### Architecture Pattern: Octopus Connector

```
                    ┌─────────────────┐
                    │   MStock API    │───┐
                    │  (WebSocket)    │   │
                    └─────────────────┘   │
                    ┌─────────────────┐   │     ┌──────────────┐     ┌─────────────┐
                    │  Flattrade API  │───┼────▶│  Normalizer  │────▶│   Kafka     │
                    │  (WebSocket)    │   │     │  (Standard   │     │ Producer    │
                    └─────────────────┘   │     │    Tick)     │     │             │
                    ┌─────────────────┐   │     └──────────────┘     └─────────────┘
                    │   Zerodha Kite  │───┤
                    │  (WebSocket)    │   │
                    └─────────────────┘   │
                    ┌─────────────────┐   │
                    │   Batch API     │───┘
                    │   (Historical)  │
                    └─────────────────┘
```

### Components

| Component           | File                       | Purpose                     |
| ------------------- | -------------------------- | --------------------------- |
| Vendor Factory      | `src/vendors/factory.js`   | Create vendor instances     |
| MStock Connector    | `src/vendors/mstock.js`    | WebSocket to MStock         |
| Flattrade Connector | `src/vendors/flattrade.js` | WebSocket to Flattrade      |
| Kite Connector      | `src/vendors/kite.js`      | WebSocket to Zerodha        |
| Composite           | `src/vendors/composite.js` | Multi-vendor aggregation    |
| Normalizer          | `src/normalizer/`          | Raw → Standard Tick format  |
| Kafka Producer      | `src/kafka/`               | Pub to `market_ticks` topic |

### Kafka Topic: `market_ticks`

- **Partitions:** 50 (one per stock)
- **Retention:** 7 days
- **Purpose:** Ensures **NO DATA LOSS** between ingestion and processing

### Historical Backfill

Automatic backfill on startup if market is closed:

1. Batch fetch via HTTP → `scripts/batch_nifty50.js`
2. Feed to Kafka → `scripts/feed_kafka.js`

---

## ⚙️ Layer 2: Processing

**Technology:** Go  
**Port:** 3002  
**Purpose:** Convert raw ticks into OHLCV candles and persist to storage

### Data Flow

```
┌─────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│   Kafka     │────▶│   Aggregation       │────▶│  TimescaleDB    │
│  Consumer   │     │   Engine            │     │  (candles_1m)   │
│             │     │  ───────────────    │     └─────────────────┘
│  Topic:     │     │  In-memory state    │              │
│  market_    │     │  per symbol         │              │
│  ticks      │     │                     │              │
└─────────────┘     │  When 1 min passes: │     ┌─────────────────┐
                    │  → Close candle     │────▶│     Redis       │
                    │  → Bulk insert DB   │     │   (hot cache)   │
                    │  → Update Redis     │     └─────────────────┘
                    └─────────────────────┘
```

### Aggregation Logic

```go
type CandleBuilder struct {
    Symbol    string
    StartTime time.Time
    Open      float64
    High      float64
    Low       float64
    Close     float64
    Volume    int64
}

// On each tick:
// 1. If within current minute: Update H/L/C/V
// 2. If minute boundary crossed: Flush to DB, start new candle
```

---

## 💾 Layer 3: Storage

**Technology:** TimescaleDB (PostgreSQL 15) + Redis 7  
**Purpose:** Persist historical data + provide hot cache for real-time

### TimescaleDB Schema

#### Hypertables (Auto-partitioned by time)

| Table             | Purpose               | Chunk Interval |
| ----------------- | --------------------- | -------------- |
| `candles_1m`      | Base 1-minute candles | 1 day          |
| `options_chain`   | Options Greeks/OI     | 1 day          |
| `signals`         | Generated signals     | 7 days         |
| `market_breadth`  | A/D ratio history     | 1 day          |
| `sector_strength` | Sector rotation       | 1 day          |

#### Continuous Aggregates (Materialized Views)

```sql
-- Automatic rollup from 1-min to higher timeframes
candles_5m   ← Aggregates every 5 minutes
candles_15m  ← Aggregates every 15 minutes
candles_1h   ← (Planned) Hourly view
candles_1d   ← (Planned) Daily view
```

### Data Volume Calculation

```
50 stocks × 375 candles/day × 20 days/month × 12 months × 5 years
= ~22.5 million rows

With TimescaleDB compression (~10x): ~2-3 GB storage
```

### Redis Data Structures

| Key Pattern                 | Type   | Purpose                 |
| --------------------------- | ------ | ----------------------- |
| `tick:latest:{symbol}`      | STRING | Last tick price         |
| `candle:1m:latest:{symbol}` | HASH   | Current building candle |
| `analysis:{symbol}`         | HASH   | Latest indicators       |
| `signals:active`            | LIST   | Pending signals         |
| `market_view:latest`        | HASH   | Current market summary  |

### Pub/Sub Channels

| Channel            | Publisher | Subscribers |
| ------------------ | --------- | ----------- |
| `market_ticks`     | L1        | L2          |
| `analysis_updates` | L4        | L5, L6      |
| `market_view`      | L5        | L6, L7      |
| `signals`          | L6        | L7          |

---

## 📈 Layer 4: Analysis

**Technology:** Go  
**Port:** 8081  
**Purpose:** Calculate technical indicators in parallel across 50 stocks

### Worker Pool Pattern

```
                    ┌─────────────────┐
                    │   Dispatcher    │
                    │                 │
                    └────────┬────────┘
                             │
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  Worker 1   │   │  Worker 2   │   │  Worker N   │
    │  RELIANCE   │   │  TCS        │   │  HDFC       │
    │  INFY       │   │  ICICI      │   │  ...        │
    └─────────────┘   └─────────────┘   └─────────────┘
           │                 │                 │
           └─────────────────┴─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Redis Pub/Sub   │
                    │ analysis_updates│
                    └─────────────────┘
```

### Technical Indicators Calculated

| Indicator       | Period         | Type           |
| --------------- | -------------- | -------------- |
| RSI             | 14             | Momentum       |
| EMA             | 9, 21, 50, 200 | Trend          |
| MACD            | 12, 26, 9      | Trend/Momentum |
| ATR             | 14             | Volatility     |
| Bollinger Bands | 20, 2          | Volatility     |
| VWAP            | Daily          | Volume Profile |

### 🤖 Future: AI Pattern Detection (Planned)

```
┌─────────────────────────────────────────┐
│  AI Analysis Engine (Python/TensorFlow) │
│  ─────────────────────────────────────  │
│  • Chart Pattern Recognition            │
│  • Candlestick Pattern Detection        │
│  • Anomaly Detection                    │
│  • Price Prediction (short-term)        │
└─────────────────────────────────────────┘
```

---

## 📊 Layer 5: Aggregation

**Technology:** Go  
**Port:** 8080  
**Purpose:** Synthesize the "Big Picture" from individual stock analysis

### Market Breadth Calculation

```
┌─────────────────────────────────────────────────────────────────┐
│  MARKET BREADTH                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  Advancing    : 35    │  Above VWAP      : 40 (80%)             │
│  Declining    : 12    │  Above 200 EMA   : 42 (84%)             │
│  Unchanged    : 3     │  New Highs       : 5                    │
│  A/D Ratio    : 2.91  │  New Lows        : 1                    │
└─────────────────────────────────────────────────────────────────┘
```

### Sector Analysis

| Sector  | Stocks                                 | Rotation Phase |
| ------- | -------------------------------------- | -------------- |
| IT      | TCS, INFY, WIPRO, HCLTECH, TECHM       | LEADING        |
| Banking | HDFC, ICICI, KOTAKBANK, SBIN, AXISBANK | IMPROVING      |
| Auto    | MARUTI, TATAMOTORS, M&M, BAJAJ-AUTO    | LAGGING        |
| Pharma  | SUNPHARMA, DRREDDY, CIPLA, DIVISLAB    | WEAKENING      |

### Composite Scoring

```
CompositeScore = (TrendScore × 0.40) + (MomentumScore × 0.30) + (BreadthScore × 0.30)

If CompositeScore > 0.3  → BULLISH
If CompositeScore < -0.3 → BEARISH
Else                      → NEUTRAL
```

---

## 🎯 Layer 6: Signal / Decision Engine

**Technology:** Node.js  
**Port:** 8082  
**Purpose:** Generate actionable BUY/SELL signals using rules + (future) AI

### Current: Rule-Based Strategies

| Strategy       | Conditions                            | Type            |
| -------------- | ------------------------------------- | --------------- |
| RSI Divergence | RSI < 30 AND Price making higher lows | Mean Reversion  |
| Golden Cross   | EMA9 crosses above EMA21              | Trend Following |
| MACD Cross     | MACD crosses signal line              | Momentum        |
| Dip Buying     | Price > EMA200 AND RSI < 40           | Pullback        |

### Signal Output Format

```json
{
  "type": "BUY",
  "instrument": "RELIANCE",
  "entry": 2450.0,
  "stopLoss": 2420.0,
  "target": 2510.0,
  "confidence": 85,
  "strategy": "DipBuy",
  "compositeScore": 0.72,
  "timestamp": "2026-01-21T10:30:00Z"
}
```

### 🤖 Future: AI Decision Model (Planned)

```
┌─────────────────────────────────────────────────────────────────┐
│  AI DECISION ENGINE                                              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  INPUTS:                     │  OUTPUTS:                        │
│  • Technical indicators      │  • BUY/SELL/HOLD probability     │
│  • Market breadth            │  • Optimal entry point           │
│  • Sector strength           │  • Risk-adjusted position size   │
│  • Historical patterns       │  • Confidence score              │
│  • News sentiment (future)   │  • Expected holding period       │
│                              │                                  │
│  MODEL OPTIONS:              │                                  │
│  • Random Forest             │                                  │
│  • LSTM Neural Network       │                                  │
│  • Reinforcement Learning    │                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ Layer 7: Presentation & Notification

### Components

| Service       | Technology | Port | Purpose           |
| ------------- | ---------- | ---- | ----------------- |
| REST API      | Fastify    | 4000 | Backend endpoints |
| Dashboard     | Next.js    | 3000 | Web UI            |
| Telegram Bot  | Node.js    | 7000 | Guru Ji alerts    |
| Email Service | Node.js    | -    | Notifications     |
| Gateway       | Nginx      | 80   | Reverse proxy     |

### API Endpoints

```
GET  /api/v1/stocks              # All 50 stocks current state
GET  /api/v1/stocks/:symbol      # Single stock details
GET  /api/v1/market-view         # Current market breadth
GET  /api/v1/signals             # Active signals
GET  /api/v1/sectors             # Sector analysis
GET  /api/v1/system-status       # Health check
WS   /ws                         # Real-time updates
```

---

## 📊 Observability Stack

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Prometheus  │────▶│   Grafana   │◀────│    Loki     │
│   :9090     │     │   :3001     │     │   :3100     │
│   Metrics   │     │ Dashboards  │     │    Logs     │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       ▲
       │                                       │
┌──────┴──────────────────────────────────────┴───────┐
│  All Services expose /metrics endpoint               │
│  • L1: websocket_packets_total, api_calls_total     │
│  • L2: candles_processed_total, db_write_latency    │
│  • L4: analysis_duration_seconds, goroutines_active │
│  • L6: signals_generated_total, strategy_matches    │
└─────────────────────────────────────────────────────┘
```

---

## 🏗️ Deployment Options

| Approach    | Config File               | Best For   | Cost       |
| ----------- | ------------------------- | ---------- | ---------- |
| Full Docker | `docker-compose.prod.yml` | Dev/Test   | ~$12-43/mo |
| Hybrid AWS  | `docker-compose.aws.yml`  | Production | ~$79/mo    |

### Hybrid AWS Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  AWS VPC (10.0.0.0/16)                                          │
│  ───────────────────────────────────────────────────────────── │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────────────┐ │
│  │  Public Subnet       │     │  Private Subnet              │ │
│  │  ┌────────────────┐  │     │  ┌────────────────────────┐  │ │
│  │  │ EC2 c6i.xlarge │  │────▶│  │ RDS PostgreSQL         │  │ │
│  │  │ Docker Host    │  │     │  │ db.t3.micro            │  │ │
│  │  │ (Kafka local)  │  │     │  └────────────────────────┘  │ │
│  │  │ (L1-L7 layers) │  │     │  ┌────────────────────────┐  │ │
│  │  └────────────────┘  │────▶│  │ ElastiCache Redis      │  │ │
│  └──────────────────────┘     │  │ cache.t3.micro         │  │ │
│                               │  └────────────────────────┘  │ │
│                               └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Architecture Alignment Check

| Your Requirement              | Current Implementation                            | Status     |
| ----------------------------- | ------------------------------------------------- | ---------- |
| Multi-vendor connectors       | ✅ MStock, Flattrade, Kite, Batch API             | ✅ Aligned |
| Kafka for data reliability    | ✅ 50 partitions, ensures no data loss            | ✅ Aligned |
| Large database with views     | ✅ TimescaleDB with 5m, 15m continuous aggregates | ✅ Aligned |
| 5 years data storage          | ✅ Compression + retention policies               | ✅ Aligned |
| Parallel analysis (50 stocks) | ✅ Go worker pool                                 | ✅ Aligned |
| Market breadth aggregation    | ✅ L5 with A/D ratio, sector analysis             | ✅ Aligned |
| Rule-based signal engine      | ✅ Multiple strategies                            | ✅ Aligned |
| AI/ML decision engine         | 🔄 Placeholders ready, implementation pending     | 🔄 Planned |
| Observability                 | ✅ Prometheus + Grafana + Loki                    | ✅ Aligned |

---

> **Next Steps:**
>
> 1. Open `Trading_System_Architecture_Complete.drawio` in Draw.io
> 2. Add additional pages for detailed layer internals
> 3. Integrate AI/ML decision engine architecture when ready
