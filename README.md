# 🚀 Nifty 50 Trading Signal System

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://golang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://docker.com/)

A high-performance, real-time trading signal system for analyzing Nifty 50 stocks and generating buy/sell signals for index options trading.

**Author:** Utkarsh Pandey

---

## 📑 Table of Contents

- [System Overview](#-system-overview)
- [Key Features](#-key-features)
- [7-Layer Architecture](#-7-layer-architecture)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Data Flow](#-data-flow)
- [Technology Stack](#-technology-stack)
- [Disclaimer](#-disclaimer)
- [License](#-license)
- [Contributing](#-contributing)

---

## 📊 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         NIFTY 50 TRADING SIGNAL SYSTEM                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   INPUT                          PROCESS                    OUTPUT      │
│   ─────                          ───────                    ──────      │
│                                                                         │
│   50 Stocks                   Analyze ALL 50              Nifty 50      │
│   Real-time Data ────────▶    SIMULTANEOUSLY  ────────▶   BUY/SELL     │
│   (Every tick)                in < 100ms                  SIGNAL        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## ⚡ Key Features

- **Ultra-Low Latency**: End-to-end processing in ~20-50ms
- **High Concurrency**: Analyze all 50 stocks simultaneously using Go goroutines
- **Real-time Analysis**: Technical indicators, market breadth, sector rotation
- **Options Intelligence**: Greeks calculation, max pain, PCR analysis
- **Multi-Channel Alerts**: Dashboard, Telegram, REST API, WebSocket

---

## 🏗️ 7-Layer Architecture

| Layer | Name | Technology | Responsibility |
|-------|------|------------|----------------|
| [**L7**](./layer-7-presentation/) | Presentation | Next.js, Socket.io | Dashboard, Alerts, API |
| [**L6**](./layer-6-signal/) | Signal Generation | Node.js | Decision Engine, Risk Management |
| [**L5**](./layer-5-aggregation/) | Aggregation | Go | Market Breadth, Sector Analysis |
| [**L4**](./layer-4-analysis/) | Analysis | Go (Goroutines) | Technical Indicators (50 parallel) |
| [**L3**](./layer-3-storage/) | Storage | Redis, TimescaleDB | Hot/Warm/Cold Storage |
| [**L2**](./layer-2-processing/) | Processing | Kafka Consumers | Candle Building, Normalization |
| [**L1**](./layer-1-ingestion/) | Ingestion | Node.js, Kafka | WebSocket, Data Feeds |

---

## 📁 Project Structure

```
nifty50-trading-system/
│
├── 📄 README.md                      # You are here
├── 📄 CONTRIBUTING.md                # How to contribute
├── 📄 docker-compose.yml             # Full stack deployment
├── 📄 .env.example                   # Environment template
│
├── 📁 layer-1-ingestion/             # Data Ingestion (Node.js)
├── 📁 layer-2-processing/            # Stream Processing (Node.js)
├── 📁 layer-3-storage/               # Storage Layer (Redis + TimescaleDB)
├── 📁 layer-4-analysis/              # Analysis Engine (Go)
├── 📁 layer-5-aggregation/           # Market Aggregation (Go)
├── 📁 layer-6-signal/                # Signal Generation (Node.js)
├── 📁 layer-7-presentation/          # UI & Alerts (Next.js + Telegram)
│
├── 📁 infrastructure/                # Docker, K8s, Monitoring
├── 📁 docs/                          # Documentation
├── 📁 scripts/                       # Utility scripts
└── 📁 tests/                         # Test suites
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ 
- **Go** 1.21+
- **Docker** & Docker Compose
- **Git**

### Step 1: Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/nifty50-trading-system.git
cd nifty50-trading-system
```

### Step 2: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your API keys
nano .env
```

### Step 3: Start Infrastructure

```bash
# Start all services (Kafka, Redis, TimescaleDB, etc.)
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Step 4: Start Application Layers

```bash
# Terminal 1: Layer 1 - Ingestion
cd layer-1-ingestion && npm install && npm start

# Terminal 2: Layer 2 - Processing  
cd layer-2-processing && npm install && npm start

# Terminal 3: Layer 4 - Analysis Engine (Go)
cd layer-4-analysis && go run cmd/main.go

# Terminal 4: Layer 5 - Aggregation (Go)
cd layer-5-aggregation && go run cmd/main.go

# Terminal 5: Layer 6 - Signal Generator
cd layer-6-signal && npm install && npm start

# Terminal 6: Layer 7 - Dashboard
cd layer-7-presentation/dashboard && npm install && npm run dev
```

### Step 5: Access Dashboard

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📈 Data Flow

```
                              ┌─────────────────┐
                              │   NSE / Broker  │
                              │   WebSocket     │
                              └────────┬────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: INGESTION                                          Latency: 1ms│
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │ WebSocket       │───▶│ Normalizer      │───▶│ Kafka Producer  │      │
│  │ Connection Pool │    │ (Unified Schema)│    │ (50 partitions) │      │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘      │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: PROCESSING                                         Latency: 5ms│
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              Kafka Consumer Group (5 consumers)                  │    │
│  │   ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐                  │    │
│  │   │ C1  │  │ C2  │  │ C3  │  │ C4  │  │ C5  │                  │    │
│  │   │10stk│  │10stk│  │10stk│  │10stk│  │10stk│                  │    │
│  │   └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘  └──┬──┘                  │    │
│  └──────┼────────┼────────┼────────┼────────┼──────────────────────┘    │
│         └────────┴────────┴────────┴────────┘                           │
│                           │                                              │
│                           ▼                                              │
│              ┌─────────────────────────┐                                 │
│              │     Candle Builder      │                                 │
│              │   (1m, 5m, 15m candles) │                                 │
│              └─────────────────────────┘                                 │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                          ┌────────────┴────────────┐
                          ▼                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: STORAGE                                                        │
│                                                                          │
│   ┌─────────────────┐              ┌─────────────────┐                  │
│   │   REDIS (HOT)   │              │  TIMESCALEDB    │                  │
│   │   < 1ms reads   │              │    (WARM)       │                  │
│   │                 │              │   1-10ms reads  │                  │
│   │ • Current price │              │ • Candle history│                  │
│   │ • Live indicators│             │ • Options chain │                  │
│   │ • Active signals│              │ • Signal history│                  │
│   └─────────────────┘              └─────────────────┘                  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 4: ANALYSIS ENGINE ⚡                                Latency: 10ms│
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │              50 GOROUTINES IN PARALLEL                         │    │
│   │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐        ┌────┐            │    │
│   │  │RELI│ │TCS │ │HDFC│ │INFY│ │ICIC│  ...   │COAL│            │    │
│   │  └──┬─┘ └──┬─┘ └──┬─┘ └──┬─┘ └──┬─┘        └──┬─┘            │    │
│   │     │      │      │      │      │             │               │    │
│   │     └──────┴──────┴──────┴──────┴─────────────┘               │    │
│   │                         │                                      │    │
│   │   Indicators: RSI, MACD, EMA, ATR, VWAP, Supertrend, BB       │    │
│   └────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 5: AGGREGATION                                        Latency: 3ms│
│                                                                          │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐              │
│   │ Market Breadth│  │Sector Analysis│  │Relative Strength│            │
│   │ • A/D Ratio   │  │ • Banking     │  │ • RS Ranking   │             │
│   │ • % > VWAP    │  │ • IT, FMCG    │  │ • Leaders      │             │
│   │ • New H/L     │  │ • Auto, Pharma│  │ • Laggards     │             │
│   └───────────────┘  └───────────────┘  └───────────────┘              │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 6: SIGNAL GENERATION                                  Latency: 2ms│
│                                                                          │
│   ┌────────────────────────────────────────────────────────────────┐    │
│   │                    DECISION MATRIX                              │    │
│   │  Trend: 25% | Breadth: 20% | Momentum: 15% | Options: 20%      │    │
│   │  Sectors: 10% | Volatility: 10%                                 │    │
│   └────────────────────────────────────────────────────────────────┘    │
│                                │                                         │
│                                ▼                                         │
│              ┌─────────────────────────────┐                            │
│              │  SIGNAL: BUY NIFTY 24500 CE │                            │
│              │  Confidence: 72%            │                            │
│              └─────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  LAYER 7: PRESENTATION                                                   │
│                                                                          │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │  Dashboard  │  │  Telegram   │  │  REST API   │  │  WebSocket  │   │
│   │  (Next.js)  │  │    Bot      │  │  (Fastify)  │  │  (Socket.io)│   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘

                    TOTAL END-TO-END LATENCY: ~20-50ms
```

---

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Ingestion** | Node.js, ws | WebSocket connections |
| **Message Queue** | Apache Kafka | Durability, replay, partitioning |
| **Processing** | Node.js + Kafka | Stream processing |
| **Hot Cache** | Redis Cluster | Sub-ms reads, Pub/Sub |
| **Time-Series DB** | TimescaleDB | Historical data, continuous aggregates |
| **Analysis Engine** | Go | Parallel computation (goroutines) |
| **API Server** | Fastify | High-performance REST |
| **Dashboard** | Next.js | Real-time UI |
| **Charts** | TradingView | Professional charting |
| **Alerts** | Telegram Bot | Mobile notifications |
| **Containers** | Docker | Containerization |
| **Orchestration** | Kubernetes | Scaling |
| **Monitoring** | Prometheus + Grafana | Metrics & visualization |

---

## ⚠️ Disclaimer

> **Risk Warning**: Trading in options involves substantial risk of loss. This system provides technical analysis and signals but **cannot guarantee profits**. Always:
> - Paper trade extensively before using real money
> - Never risk more than you can afford to lose
> - Consult with a SEBI-registered investment advisor
> - This is for educational purposes only

---

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details.

---

**Built with ❤️ by Utkarsh Pandey**

⭐ **Star this repo if you find it helpful!**
