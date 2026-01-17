# Layer 2: Processing

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview
This layer consumes raw ticks from Kafka, processes them into OHLCV candles (1m, 5m, 15m), and manages state.

## Technology Stack
- **Runtime**: Node.js 18+
- **Key Libraries**: `kafkajs`, `redis`
- **Pattern**: Stream Processing (Consumer Group)

## 🚀 How to Run

### Option 1: Docker (Recommended)
```bash
# From project root
docker-compose up -d layer-2-processing
```

### Option 2: Local Development
Requires Kafka and Redis to be running.

```bash
# 1. Install dependencies
npm install

# 2. Configure Environment
cp .env.example .env

# 3. Start Service
npm start
```

## Authors
- **Yogendra Singh**
