# Stock Analysis By Gurus - AI-Driven Trading System

**"India's First Complex to Simple AI Driven Stock Analysis Application"**

[![System Status](https://img.shields.io/badge/System-Online-green)](http://localhost:3000)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](./docker-compose.yml)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

---

## 📖 Overview

A comprehensive, microservices-based trading and analysis platform for **Nifty 50** stocks. Built with **Golang**, **Node.js**, **Kafka**, **Redis**, **TimescaleDB**, and **Next.js**.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        LAYER 7: PRESENTATION                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Dashboard  │  │     API      │  │ Telegram Bot │              │
│  │   (Next.js)  │  │  (Fastify)   │  │   (Node.js)  │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
┌─────────────────────────────────────────────────────────────────────┐
│  L6: SIGNAL     │  L5: AGGREGATION   │  L4: ANALYSIS               │
│  (Node.js)      │  (Go)              │  (Go)                       │
│  Buy/Sell Logic │  Market Breadth    │  RSI, EMA, MACD             │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
┌─────────────────────────────────────────────────────────────────────┐
│                         LAYER 3: STORAGE                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │    Redis     │  │ TimescaleDB  │  │    Kafka     │              │
│  │   (Cache)    │  │ (Time-Series)│  │  (Streaming) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
                                ▲
┌─────────────────────────────────────────────────────────────────────┐
│  L2: PROCESSING              │  L1: INGESTION                       │
│  (Go)                        │  (Node.js)                           │
│  OHLCV Aggregation           │  WebSocket → MStock/Flattrade        │
└─────────────────────────────────────────────────────────────────────┘
```

### Layer Summary

| Layer  | Name         | Tech                  | Purpose                                            |
| ------ | ------------ | --------------------- | -------------------------------------------------- |
| **L1** | Ingestion    | Node.js               | WebSocket connection to broker, raw tick streaming |
| **L2** | Processing   | Go                    | Tick → OHLCV candle aggregation                    |
| **L3** | Storage      | Redis/Timescale/Kafka | Data persistence and messaging                     |
| **L4** | Analysis     | Go                    | Technical indicators (RSI, EMA, MACD)              |
| **L5** | Aggregation  | Go                    | Market breadth, sector analysis                    |
| **L6** | Signal       | Node.js               | Trading strategy evaluation                        |
| **L7** | Presentation | Next.js/Fastify       | Dashboard, API, Notifications                      |

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose v2.20+
- Make (optional)

### Step 1: Setup Environment

```bash
cp .env.example .env     # Copy template
# Edit .env with your broker API credentials (see .env.example for details)
```

### Option 1: Full Stack (Recommended)

```bash
make up          # Start everything
make down        # Stop everything
```

### Option 2: Granular Control

```bash
make infra       # Data stores only (Kafka, Redis, DB)
make app         # Application pipeline (L1-L6 + API)
make ui          # Dashboard only (fast rebuild!)
make observe     # Monitoring (Prometheus, Grafana)
```

### Option 3: Direct Docker Compose

```bash
docker-compose up -d      # Start all (uses modular includes)
docker-compose down       # Stop all
```

### Access Points

| Service       | URL                   |
| ------------- | --------------------- |
| **Dashboard** | http://localhost:3000 |
| **API**       | http://localhost:4000 |
| **Grafana**   | http://localhost:3001 |
| **Kafka UI**  | http://localhost:8090 |
| **PgAdmin**   | http://localhost:5050 |

---

## 📂 Project Structure

```
Trading-System/
├── layer-1-ingestion/       # WebSocket client (Node.js)
├── layer-2-processing/      # Kafka consumer (Go)
├── layer-3-storage/         # Database migrations
├── layer-4-analysis/        # Technical analysis (Go)
├── layer-5-aggregation/     # Market breadth (Go)
├── layer-6-signal/          # Signal generation (Node.js)
├── layer-7-presentation-notification/
│   ├── api/                   # REST API (Fastify)
│   ├── stock-analysis-portal/ # Dashboard (Next.js)
│   ├── telegram-bot/          # Guru Ji Bot
│   └── email-service/         # Email Notifications
├── infrastructure/
│   ├── compose/             # Modular Docker Compose files
│   ├── monitoring/          # Prometheus, Grafana configs
│   └── gateway/             # Nginx reverse proxy
├── vendor/                  # Shared data files
└── Makefile                 # All commands
```

---

## 📖 Documentation Index

Each layer has its own documentation:

| Document                                                                                   | Description                       |
| ------------------------------------------------------------------------------------------ | --------------------------------- |
| [infrastructure/INSTRUCTIONS.md](infrastructure/INSTRUCTIONS.md)                           | Infrastructure & deployment guide |
| [infrastructure/compose/README.md](infrastructure/compose/README.md)                       | Modular Docker Compose guide      |
| [layer-1-ingestion/README.md](layer-1-ingestion/README.md)                                 | Data ingestion layer              |
| [layer-1-ingestion/INSTRUCTIONS.md](layer-1-ingestion/INSTRUCTIONS.md)                     | L1 setup instructions             |
| [layer-2-processing/README.md](layer-2-processing/README.md)                               | Tick processing layer             |
| [layer-3-storage/README.md](layer-3-storage/README.md)                                     | Database schema                   |
| [layer-4-analysis/README.md](layer-4-analysis/README.md)                                   | Technical analysis engine         |
| [layer-5-aggregation/INSTRUCTIONS.md](layer-5-aggregation/INSTRUCTIONS.md)                 | Aggregation layer                 |
| [layer-6-signal/README.md](layer-6-signal/README.md)                                       | Signal generation                 |
| [layer-7-presentation-notification/README.md](layer-7-presentation-notification/README.md) | Frontend & API                    |

---

## 🐳 Docker Compose Structure

We use a **modular compose architecture** for flexibility:

```yaml
# docker-compose.yml (root) includes:
include:
  - infrastructure/compose/docker-compose.infra.yml # Data stores
  - infrastructure/compose/docker-compose.observe.yml # Monitoring
  - infrastructure/compose/docker-compose.app.yml # Pipeline
  - infrastructure/compose/docker-compose.ui.yml # Frontend
```

See [infrastructure/compose/README.md](infrastructure/compose/README.md) for details.

---

## 🌐 Public Sharing

Expose the system publicly using Cloudflare Tunnel:

```bash
make share       # Start tunnel
make share-url   # Get public URL
```

See [EXPOSURE_GUIDE.md](EXPOSURE_GUIDE.md) for details.

---

## 💾 Database Backup & Restore

```bash
make backup      # Create timestamped backup to ./backups/
make restore     # Restore from latest or selected backup
```

Backups are SQL dumps stored in `./backups/` and persist across container restarts.

---

## 📊 Observability

- **Prometheus**: http://localhost:9090 (metrics)
- **Grafana**: http://localhost:3001 (dashboards)
  - **System Overview**: Pipeline health and metrics
  - **Container Resources**: CPU/Memory per layer
  - **Telegram Bot**: Bot command analytics
- **System Status API**: http://localhost:4000/api/v1/system-status

---

## 🧪 Development

```bash
make dev         # Start infra for local dev
make layer1      # Run L1 locally
make test        # Run all tests
make logs        # Tail all logs
```

---

## ⚖️ Legal Disclaimer

_This Application is designed by Yogendra and Utkarsh. Unauthorized reproduction or copying of these unique ideas will lead to legal action._
