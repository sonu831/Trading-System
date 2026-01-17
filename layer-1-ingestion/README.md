# 📥 Layer 1: Data Ingestion

**Technology:** Node.js  
**Latency:** ~1ms  
**Responsibility:** Connect to market data sources and feed raw ticks into Kafka

---

## 📋 Overview

The Data Ingestion Layer is the entry point for all market data. It establishes WebSocket connections to various data providers, normalizes the incoming data, and publishes it to Apache Kafka for downstream processing.

## 🏗️ Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  NSE Feed   │  │  Zerodha    │  │   Upstox    │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
              ┌─────────────────────┐
              │  WebSocket Manager  │
              │  ┌───────────────┐  │
              │  │ Connection    │  │
              │  │ Pool (50)     │  │
              │  └───────────────┘  │
              │  ┌───────────────┐  │
              │  │ Auto-Reconnect│  │
              │  └───────────────┘  │
              │  ┌───────────────┐  │
              │  │ Heartbeat     │  │
              │  └───────────────┘  │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Message Normalizer │
              │  - Unified format   │
              │  - Validation       │
              │  - Timestamp sync   │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Kafka Producer    │
              │   Topic: raw-ticks  │
              │   Key: symbol       │
              │   Partitions: 50    │
              └─────────────────────┘
```

## 📁 Directory Structure

```
layer-1-ingestion/
├── README.md                 # This file
├── package.json              # Dependencies
├── Dockerfile                # Container build
├── .env.example              # Environment template
│
├── src/
│   ├── index.js              # Entry point
│   │
│   ├── websocket/
│   │   ├── manager.js        # Connection manager
│   │   ├── zerodha.js        # Zerodha Kite adapter
│   │   ├── upstox.js         # Upstox adapter
│   │   └── reconnection.js   # Reconnection logic
│   │
│   ├── normalizer/
│   │   ├── index.js          # Main normalizer
│   │   ├── schema.js         # Unified tick schema
│   │   └── validators.js     # Data validation
│   │
│   └── kafka/
│       ├── producer.js       # Kafka producer
│       └── partitioner.js    # Symbol-based partitioning
│
└── config/
    ├── default.json          # Default configuration
    └── symbols.json          # Nifty 50 symbol list
```

## 🚀 Quick Start

### Install Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### Start Service

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ZERODHA_API_KEY` | Zerodha Kite API key | Yes |
| `ZERODHA_ACCESS_TOKEN` | Zerodha access token | Yes |
| `KAFKA_BROKERS` | Kafka broker addresses | Yes |
| `LOG_LEVEL` | Logging level | No |

### Nifty 50 Symbols (config/symbols.json)

```json
{
  "nifty50": [
    { "symbol": "RELIANCE", "token": 256265, "exchange": "NSE" },
    { "symbol": "TCS", "token": 2953217, "exchange": "NSE" },
    { "symbol": "HDFCBANK", "token": 341249, "exchange": "NSE" }
  ]
}
```

## 📊 Unified Tick Schema

All incoming data is normalized to this format:

```javascript
{
  symbol: "RELIANCE",           // Stock symbol
  exchange: "NSE",              // Exchange
  timestamp: 1705487400000,     // Unix timestamp (ms)
  ltp: 2456.75,                 // Last traded price
  ltq: 100,                     // Last traded quantity
  volume: 5234567,              // Total volume
  bid: 2456.50,                 // Best bid
  ask: 2457.00,                 // Best ask
  open: 2445.00,                // Day open
  high: 2460.00,                // Day high
  low: 2440.00,                 // Day low
  close: 2448.00                // Previous close
}
```

## 📈 Monitoring

### Health Check

```bash
curl http://localhost:3001/health
```

### Prometheus Metrics

```bash
curl http://localhost:3001/metrics
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| `ingestion_ticks_total` | Total ticks received |
| `ingestion_ticks_per_second` | Current tick rate |
| `websocket_connections_active` | Active connections |
| `websocket_reconnections_total` | Reconnection count |
| `kafka_messages_sent_total` | Messages sent to Kafka |

## 🐳 Docker

### Build

```bash
docker build -t nifty50-ingestion .
```

### Run

```bash
docker run -d \
  --name ingestion \
  -e ZERODHA_API_KEY=xxx \
  -e KAFKA_BROKERS=kafka:9092 \
  nifty50-ingestion
```

## 🧪 Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage
npm run test:coverage
```

---

**Next Layer:** [Layer 2 - Processing](../layer-2-processing/README.md)
