# Layer 1: Data Ingestion Service

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview

Layer 1 is the **entry point** for all market data into the trading system. It connects to broker WebSocket APIs (MStock, Kite, FlatTrade), normalizes the data, and publishes it to Kafka for downstream processing.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Layer 1: Ingestion                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐    ┌────────────┐    ┌─────────┐    ┌───────┐ │
│  │ MStock  │───▶│ Normalizer │───▶│  Kafka  │───▶│Layer 2│ │
│  │ WebSocket│   │            │    │ Producer│    │       │ │
│  └─────────┘    └────────────┘    └─────────┘    └───────┘ │
│  ┌─────────┐                                                │
│  │  Kite   │───────────────▶ (Same Flow)                   │
│  └─────────┘                                                │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component     | Technology               |
| ------------- | ------------------------ |
| Runtime       | Node.js 18+              |
| WebSocket     | MStock SDK, KiteConnect  |
| Message Queue | KafkaJS                  |
| Metrics       | prom-client (Prometheus) |
| Logging       | Winston                  |

## Key Features

- **Multi-Vendor Support**: MStock, Kite, FlatTrade via vendor abstraction
- **Auto-Authentication**: 2-step TOTP-based login for MStock
- **Market-Aware Mode**: Skips WebSocket during off-hours, runs historical backfill instead
- **Batch Historical Fetch**: Downloads 5 days of 1-minute candles for Nifty 50
- **Prometheus Metrics**: Tracks ticks received, Kafka messages sent, connection status

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- MStock/Kite API credentials in `.env`

### Option 1: Using Makefile (Recommended)

```bash
# From project root
make infra          # Start Kafka, Redis, TimescaleDB
make layer1         # Start Layer 1 in dev mode
```

### Option 2: Local Development

```bash
# 1. Install dependencies
cd layer-1-ingestion
npm install

# 2. Configure Environment
cp ../.env.example ../.env
# Edit .env with your broker credentials

# 3. Start in development mode
npm run dev
```

### Option 3: Docker

```bash
# From project root
docker-compose up -d ingestion
```

## 📊 Batch Historical Data Ingestion

Fetch historical 1-minute candles for Nifty 50 stocks:

```bash
# Fetch all 50 stocks (last 5 working days)
make batch

# Fetch single stock
make batch-symbol SYMBOL=RELIANCE

# With custom days
cd layer-1-ingestion
node scripts/batch_nifty50.js --symbol RELIANCE --days 3
```

**Output**: JSON files saved to `data/historical/{SYMBOL}_ONE_MINUTE.json`

## 📤 Feed Historical Data to Kafka

Push downloaded historical data to Kafka for Layer 2 processing:

```bash
make feed
# Or manually:
cd layer-1-ingestion
node scripts/feed_kafka.js
```

## 🔧 Configuration

### Environment Variables

| Variable             | Description            | Default          |
| -------------------- | ---------------------- | ---------------- |
| `MSTOCK_API_KEY`     | MStock API Key         | Required         |
| `MSTOCK_CLIENT_CODE` | MStock Client Code     | Required         |
| `MSTOCK_PASSWORD`    | MStock Login Password  | Required         |
| `MSTOCK_TOTP_SECRET` | TOTP Secret for 2FA    | Required         |
| `KAFKA_BROKERS`      | Kafka broker addresses | `localhost:9092` |
| `INGESTION_PORT`     | Health/Metrics port    | `3001`           |

### Symbol Configuration

Nifty 50 symbols are defined in `vendor/nifty50_shared.json`:

```json
{
  "symbol": "RELIANCE",
  "exchange": "NSE",
  "tokens": {
    "kite": "256265",
    "mstock": "2885"
  }
}
```

## 📈 Prometheus Metrics

Access at: `http://localhost:3001/metrics`

| Metric                                | Type      | Description                 |
| ------------------------------------- | --------- | --------------------------- |
| `ingestion_ticks_received_total`      | Counter   | Total ticks from WebSocket  |
| `ingestion_kafka_messages_sent_total` | Counter   | Messages sent to Kafka      |
| `ingestion_websocket_connected`       | Gauge     | WebSocket connection status |
| `http_request_duration_seconds`       | Histogram | HTTP request latency        |

## 📁 Directory Structure

```
layer-1-ingestion/
├── src/
│   ├── index.js           # Main entry point
│   ├── vendors/           # Broker implementations
│   │   ├── base.js        # BaseVendor abstract class
│   │   ├── mstock.js      # MStock implementation
│   │   ├── kite.js        # Kite implementation
│   │   └── factory.js     # Vendor factory
│   ├── mappers/           # Data normalization
│   │   ├── base.js        # BaseMapper
│   │   └── mstock.js      # MStock data mapper
│   ├── normalizer/        # Tick normalization
│   └── utils/             # Utilities
│       ├── logger.js      # Winston logger
│       ├── market-hours.js # Market open/close logic
│       └── request-utils.js
├── scripts/
│   ├── batch_nifty50.js   # Historical data fetcher
│   └── feed_kafka.js      # Kafka data feeder
├── data/
│   └── historical/        # Downloaded JSON files
├── config/
│   └── symbols.json       # Symbol list
└── package.json
```

## 🔍 Troubleshooting

### Common Issues

**1. "502 Bad Gateway" on WebSocket**

- MStock WebSocket may be down during off-hours
- System automatically skips WebSocket when market is closed

**2. "401 Invalid Request" on Historical API**

- Token expired; system auto-reauthenticates
- Check `.env` credentials are correct

**3. "Missing credentials" in batch script**

- Ensure `.env` is in project root, not layer-1-ingestion folder

## Authors

- **Yogendra Singh**
