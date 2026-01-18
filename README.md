# Stock Analysis By Gurus - AI-Driven Trading System

**"India's First Complex to Simple AI Driven Stock Analysis Application"**

[![System Status](https://img.shields.io/badge/System-Online-green)](http://localhost:3000)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue)](./docker-compose.yml)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

## 📖 Overview

This system is a comprehensive, microservices-based high-frequency trading (HFT) and analysis platform designed to ingest, process, analyze, and visualize Nifty 50 stock data in real-time. It leverages a modern tech stack including **Golang**, **Node.js**, **Kafka**, **Redis**, **TimeScaleDB**, and **Next.js**.

The architecture follows a strictly layered approach (Layer 1 to Layer 7), ensuring separation of concerns, scalability, and fault tolerance.

---

## 🏗 System Architecture

The system is organized into 7 distinct layers:

| Layer  | Name             | Tech Stack         | Responsibility                                                                                                            |
| ------ | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| **L1** | **Ingestion**    | Node.js            | Connects to Stock Broker (MStock) via WebSocket, fetches live ticks, and pushes raw data to Kafka.                        |
| **L2** | **Processing**   | Go (Golang)        | Consumes raw Kafka ticks, aggregates them into 1-minute Candle bars (OHLCV), and stores them in TimeScaleDB.              |
| **L3** | **Storage**      | Postgres/Timescale | The Database layer. Stores historical candle data (TimeScaleDB) and real-time state (Redis).                              |
| **L4** | **Analysis**     | Go (Golang)        | The "Brain". Fetches candles, calculates Technical Indicators (RSI, EMA, MACD), and publishes metrics. Uses Worker Pools. |
| **L5** | **Aggregation**  | Go (Golang)        | Aggregates individual stock analysis into Market Breadth, Sector Performance, and Sentiment Scores.                       |
| **L6** | **Signal**       | Node.js            | Evaluates trading strategies against aggregated data to generate Buy/Sell signals.                                        |
| **L7** | **Presentation** | Next.js / Fastify  | The Frontend Dashboard and API Gateway. Visualizes everything for the user.                                               |

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Make (optional, for convenience)

### Running the System

The entire system is containerized. You can launch it with a single command:

```bash
# Start all application services (L1-L7) and Infrastructure
docker-compose --profile app up -d
```

### Accessing the Dashboard

Once started, the dashboard is available at:
👉 **[http://localhost:3000](http://localhost:3000)**

### Accessing System Metrics

Technical metrics and health status are available at:
👉 **[http://localhost:4000/api/v1/system-status](http://localhost:4000/api/v1/system-status)**

---

## 🔧 Infrastructure Components

- **Kafka**: The central nervous system. Used for streaming raw ticks from L1 to L2.
  - _Port_: `9092`
- **Redis**: High-speed cache and Pub/Sub mechanism. Used for inter-service communication (L4 -> L5 -> L7) and real-time UI updates.
  - _Port_: `6379`
- **TimeScaleDB**: Time-series optimized PostgreSQL. Stores historical candle data.
  - _Port_: `5432`

## 📊 Control & Observability

The system features advanced monitoring and control mechanisms:

- **Manual Backfill Control**: Trigger historical data synchronization on-demand via the dashboard or `POST /api/v1/system/backfill/trigger`.
- **Granular Progress Tracking**: Live visibility into backfill stages (Initialization -> Data Fetching -> Kafka Feeding) at the individual stock level.
- **Deep Network Telemetry**: Tracking of raw WebSocket packets, average bandwidth (KB/s), and external API latency for all market data vendors.
- **IPC Metric Bridge**: Seamless aggregation of performance metrics from background worker processes into the main service registry.

## 👨‍💻 Developer Guide

### Directory Structure

- `layer-1-ingestion/`: Node.js WebSocket client.
- `layer-2-processing/`: Go Kafka consumer & aggregator.
- `layer-4-analysis/`: Go technical analysis engine.
- `layer-5-aggregation/`: Go market breadth engine.
- `layer-6-signal/`: Node.js strategy engine.
- `layer-7-presentation/`:
  - `api/`: Fastify REST API.
  - `dashboard/`: Next.js Frontend.

### Common Commands

```bash
# Rebuild a specific service (e.g., Dashboard)
docker-compose --profile app up -d --build dashboard

# View logs for a service
docker-compose logs -f analysis
```

## ⚖️ Legal Disclaimer

_This Application is designed by Yogendra and Utkarsh. Unauthorized reproduction or copying of these unique ideas will lead to legal action._
