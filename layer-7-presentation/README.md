# Layer 7: Presentation

**Deep Dive Documentation**: [Developer Instructions](./INSTRUCTIONS.md)

## Overview
The user interface and alert system. Consists of a Dashboard, API, and Telegram Bot.

## Components
1. **Dashboard**: Next.js (React)
2. **API**: Fastify (Node.js)
3. **Bot**: Telegraf (Node.js)

## 🚀 How to Run

### Option 1: Docker (Recommended)
```bash
# From project root
docker-compose up -d layer-7-dashboard layer-7-api layer-7-bot
```

### Option 2: Local Development

**Dashboard:**
```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:3000
```

**API:**
```bash
cd api
npm install
npm start
```

**Telegram Bot:**
```bash
cd telegram-bot
npm install
npm start
```

## Authors
- **Yogendra Singh**
