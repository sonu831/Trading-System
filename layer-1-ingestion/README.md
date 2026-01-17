# Layer 1: Ingestion

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview
This layer handles the real-time ingestion of market data (ticks) from WebSocket sources and pushes them to Kafka.

## Technology Stack
- **Runtime**: Node.js 18+
- **Key Libraries**: `ws` (WebSocket), `kafkajs` (Kafka Client)
- **Protocol**: WebSocket (Ingress) -> Kafka (Egress)

## 🚀 How to Run

### Option 1: Docker (Recommended)
This will start the service along with its dependencies (Kafka, Zookeeper).

```bash
# From project root
docker-compose up -d layer-1-ingestion
```

### Option 2: Local Development
Ensure you have a local Kafka instance running or port-forwarded.

```bash
# 1. Install dependencies
npm install

# 2. Configure Environment
cp .env.example .env
# Edit .env with your Kafka broker URL

# 3. Start Service
npm start
```

## Authors
- **Yogendra Singh**
