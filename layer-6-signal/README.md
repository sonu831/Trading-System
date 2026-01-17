# Layer 6: Signal Generation

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview
The decision engine that combines technical analysis and market breadth to generate Buy/Sell signals.

## Technology Stack
- **Runtime**: Node.js 18+
- **Logic**: Weighted Scoring Matrix
- **Outputs**: Redis Pub/Sub, Database

## 🚀 How to Run

### Option 1: Docker (Recommended)
```bash
# From project root
docker-compose up -d layer-6-signal
```

### Option 2: Local Development
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
