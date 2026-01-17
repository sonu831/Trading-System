# 🖥️ Layer 7: Presentation

**Technology:** Next.js, Fastify, Socket.io, Telegram Bot  
**Responsibility:** Deliver signals and analysis to users

---

## 📋 Overview

The Presentation Layer provides multiple output channels for users to receive trading signals and monitor market analysis:

1. **Dashboard** - Real-time web UI with charts
2. **REST API** - For integration and historical data
3. **WebSocket** - Live streaming updates
4. **Telegram Bot** - Instant mobile alerts

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT CHANNELS                          │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  DASHBOARD  │  │  TELEGRAM   │  │  REST API   │         │
│  │  (Next.js)  │  │    BOT      │  │  (Fastify)  │         │
│  │             │  │             │  │             │         │
│  │ • Charts    │  │ • Instant   │  │ • History   │         │
│  │ • Heatmaps  │  │   alerts    │  │ • Webhooks  │         │
│  │ • Signals   │  │ • Commands  │  │ • Auth      │         │
│  │ • Analysis  │  │ • Subscribe │  │ • Rate limit│         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           WEBSOCKET SERVER (Socket.io)              │   │
│  │           Real-time streaming to all clients         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Directory Structure

```
layer-7-presentation/
├── README.md
│
├── dashboard/                 # Next.js Dashboard
│   ├── package.json
│   ├── next.config.js
│   ├── src/
│   │   ├── pages/
│   │   │   ├── index.js      # Main dashboard
│   │   │   ├── signals.js    # Signal history
│   │   │   └── analysis.js   # Detailed analysis
│   │   └── components/
│   │       ├── Chart.js      # TradingView chart
│   │       ├── Heatmap.js    # Stock heatmap
│   │       ├── SignalCard.js # Signal display
│   │       └── Breadth.js    # Market breadth
│   └── Dockerfile
│
├── api/                       # REST API (Fastify)
│   ├── package.json
│   ├── src/
│   │   ├── index.js
│   │   ├── routes/
│   │   │   ├── signals.js
│   │   │   ├── analysis.js
│   │   │   └── health.js
│   │   └── middleware/
│   │       ├── auth.js
│   │       └── ratelimit.js
│   └── Dockerfile
│
└── telegram-bot/              # Telegram Bot
    ├── package.json
    ├── src/
    │   ├── index.js
    │   ├── handlers/
    │   │   ├── commands.js
    │   │   └── alerts.js
    │   └── templates/
    │       └── signal.js
    └── Dockerfile
```

---

## 📱 Dashboard (Next.js)

### Features

- **Real-time Charts** - TradingView charting library
- **Stock Heatmap** - Visual representation of all 50 stocks
- **Signal Cards** - Current and historical signals
- **Market Breadth** - A/D ratio, % above VWAP
- **Sector Analysis** - Sector rotation visualization

### Setup

```bash
cd dashboard
npm install
npm run dev    # Development
npm run build  # Production
```

### Access

- Development: http://localhost:3000
- Production: Configure via `NEXT_PUBLIC_API_URL`

---

## 🔌 REST API (Fastify)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/signals` | Get recent signals |
| GET | `/api/signals/:id` | Get signal by ID |
| GET | `/api/analysis/current` | Current market analysis |
| GET | `/api/analysis/stocks` | All stock analyses |
| GET | `/api/breadth` | Market breadth |
| GET | `/api/sectors` | Sector analysis |
| WS | `/ws` | WebSocket connection |

### Example Response

```bash
curl http://localhost:4000/api/signals
```

```json
{
  "status": "success",
  "data": [
    {
      "id": "SIG-20240117-1030",
      "type": "BUY",
      "instrument": "NIFTY 24500 CE",
      "entry_price": 75.00,
      "confidence": 72
    }
  ]
}
```

### Setup

```bash
cd api
npm install
npm start
```

---

## 🤖 Telegram Bot

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Subscribe to alerts |
| `/stop` | Unsubscribe from alerts |
| `/status` | Current market status |
| `/signal` | Latest signal |
| `/breadth` | Market breadth |
| `/help` | Help message |

### Alert Format

```
🟢 NEW SIGNAL: BUY

📊 Instrument: NIFTY 24500 CE
📅 Expiry: 18-Jan-2024

💰 Entry: ₹75.00
🛑 Stop Loss: ₹50.00
🎯 Target: ₹100.00

📈 Confidence: 72%
⚖️ Risk:Reward: 1:2

🔥 Market: BULLISH TRENDING
📊 Nifty: 24,450
```

### Setup

```bash
cd telegram-bot

# Configure bot token
export TELEGRAM_BOT_TOKEN=your_token_here

npm install
npm start
```

---

## 🔧 WebSocket Events

### Channels

| Event | Description |
|-------|-------------|
| `signal:new` | New trading signal |
| `tick:update` | Price update |
| `analysis:update` | Analysis refresh |
| `breadth:update` | Breadth metrics |

### Client Example

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

socket.on('signal:new', (signal) => {
  console.log('New signal:', signal);
});

socket.on('tick:update', (tick) => {
  console.log('Price update:', tick);
});
```

---

**Previous:** [Layer 6 - Signal](../layer-6-signal/README.md)  
**Back to:** [Main README](../README.md)
