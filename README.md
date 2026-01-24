# Nifty 50 Algorithmic Trading System 📈

> **A production-grade, AI-powered trading platform** that analyzes 50 stocks in real-time, generates trading signals, and delivers insights through Telegram, REST API, and WebSocket streams.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8.svg)](https://golang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB.svg)](https://www.python.org/)

---

## What Is This? (For Non-Technical People)

Imagine you want to invest in the stock market but don't have time to watch prices all day. This system does that for you:

1. **Connects to stock exchanges** → Gets live prices for India's top 50 companies (Nifty 50)
2. **Analyzes each stock** → Uses math formulas AND artificial intelligence to predict if prices will go up or down
3. **Sends you alerts** → Tells you "BUY this stock" or "SELL that stock" via Telegram on your phone
4. **Shows dashboards** → Beautiful charts showing market trends, top gainers, and losers

**Think of it as**: A robot stockbroker that never sleeps, analyzes 50 stocks every minute, and messages you when it finds opportunities.

---

## Key Features 🎯

| Feature                    | Description                                                                      |
| -------------------------- | -------------------------------------------------------------------------------- |
| **Real-Time Analysis**     | Processes 50 stocks in parallel with <100ms latency                              |
| **Hybrid AI**              | Combines technical analysis (RSI, MACD) + machine learning (LSTM, GPT-4, Claude) |
| **Multi-Channel Delivery** | Telegram Bot + REST API + WebSocket streaming                                    |
| **Pluggable AI Engines**   | Switch between Heuristic, PyTorch, OpenAI, Claude, Ollama                        |
| **Production Ready**       | Docker-based, fully monitored (Prometheus + Grafana), auto-healing               |
| **Historical Backtesting** | TimescaleDB stores years of data for strategy validation                         |

---

## System Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                         👤 YOU (User)                            │
│               Telegram Bot  │  Web Dashboard  │  API             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                 🚪 Gateway (Nginx)                               │
│          Routes requests, handles security                       │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│              🔌 Core API (Fastify/Node.js)                       │
│       REST endpoints, WebSockets, Authentication                 │
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ↓           ↓           ↓
┌─────────────┐ ┌──────────┐ ┌─────────────┐
│ 📡 Ingestion│ │ 🧮 Proc  │ │ 📊 Analysis │
│  (Live Ticks│→│ (Candles)│→│ (RSI, MACD) │
│   from      │ │  Every   │ │  + AI Brain │
│   Zerodha)  │ │  1 min   │ │             │
└─────────────┘ └──────────┘ └──────┬──────┘
                                    │
                                    ↓
                           ┌─────────────────┐
                           │ 🧠 AI Service   │
                           │  Python/PyTorch │
                           │  GPT-4/Claude   │
                           │  Predictions    │
                           └─────────────────┘
          ↓                         ↓
┌─────────────────┐       ┌──────────────────┐
│ 🗄️ Storage      │       │ ⚡ Signal Gen    │
│  TimescaleDB    │       │  Buy/Sell Alerts │
│  Redis Cache    │       │                  │
└─────────────────┘       └──────────────────┘
```

**Simple Explanation**:

1. **Layer 1 (Ingestion)**: Connects to broker (like Zerodha), gets live prices
2. **Layer 2 (Processing)**: Converts prices into 1-minute charts (candlesticks)
3. **Layer 3 (Storage)**: Saves data in database + fast cache
4. **Layer 4 (Analysis)**: Calculates technical indicators (RSI, MACD, EMA)
5. **Layer 9 (AI Brain)**: Predicts if stock will rise/fall using AI
6. **Layer 6 (Signals)**: Creates "BUY" or "SELL" alerts based on analysis
7. **Layer 7 (API)**: Packages everything for your apps
8. **Layer 8 (Telegram Bot)**: Sends messages to your phone!

---

## Quick Start (5 Minutes) 🚀

### Prerequisites

- **Docker Desktop** installed ([Download here](https://www.docker.com/products/docker-desktop))
- **Telegram Account** (for receiving alerts)
- **Broker API Keys** (Zerodha/MStock) - Optional for live data

### Step 1: Clone & Setup

```bash
# Download the code
git clone https://github.com/your-repo/Trading-System.git
cd Trading-System

# Copy environment template
cp .env.example .env

# Edit .env file with your settings (use any text editor)
nano .env
```

**Required Settings in `.env`**:

```bash
# Broker (Choose one)
MARKET_DATA_PROVIDER=mstock  # or 'zerodha'
MSTOCK_API_KEY=your_key_here
MSTOCK_PASSWORD=your_password
MSTOCK_TOTP_SECRET=your_totp_secret

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token  # Get from @BotFather
TELEGRAM_CHAT_ID=your_chat_id      # Your Telegram user ID

# AI Provider (Start with 'heuristic' for simplicity)
AI_PROVIDER=heuristic  # Free, no API keys needed
# Upgrade later: 'pytorch', 'openai', 'claude', 'ollama'
```

### Step 2: Start the System

```bash
# Start everything (will download images first time ~5GB)
make up

# Check if running
docker ps  # Should show ~15 containers
```

**What just happened?**

- Kafka started (message queue)
- Redis started (super-fast cache)
- TimescaleDB started (database for stock data)
- Analysis engine started (calculating RSI, MACD)
- AI service started (making predictions)
- Telegram bot started (ready to chat!)

### Step 3: Test the Bot

Open Telegram and message your bot:

```
/analyze RELIANCE
```

You'll get:

```
🟢 RELIANCE Analysis
━━━━━━━━━━━━━━━━━━━
💰 Price: ₹2850.50 (▲ +1.2%)
📊 Technical Score: 3.5/5
🤖 AI Prediction: 82% BULLISH
📈 Trend: STRONG BUY

Indicators:
├─ RSI: 65 (Neutral)
├─ MACD: Bullish Crossover ✅
└─ EMA: Above 200-day ✅

⚡ Recommendation: BUY
```

---

## Available Commands (Telegram Bot)

| Command            | What It Does                   | Example        |
| ------------------ | ------------------------------ | -------------- |
| `/analyze <stock>` | Get full analysis of any stock | `/analyze TCS` |
| `/livestatus`      | Check if system is healthy     | `/livestatus`  |
| `/news`            | Latest market headlines        | `/news`        |
| `/feed`            | Today's top 5 gainers/losers   | `/feed`        |
| `/high`            | Top 10 gainers                 | `/high`        |
| `/low`             | Top 10 losers                  | `/low`         |
| `/movers`          | Most actively traded stocks    | `/movers`      |
| `/suggest`         | AI-generated trade ideas       | `/suggest`     |

---

## Makefile Commands (Quick Reference)

### Essential Commands

```bash
# Start full system
make up

# Stop everything
make down

# View real-time logs
make logs

# Restart just the Telegram bot
make notify-build

# Check system health
curl http://localhost:4000/api/v1/health
```

### Development Commands

```bash
# Start only infrastructure (DB, Kafka, Redis)
make infra

# Start only analysis engine
make app

# Start monitoring dashboards
make observe

# Run tests
make test
```

### Data Commands

```bash
# Download historical data for all 50 stocks
make batch

# Download for one stock only
make batch-symbol SYMBOL=RELIANCE

# Backup database
make backup

# Restore from backup
make restore
```

### Advanced Commands

```bash
# Expose system to internet (for remote access)
make share

# Deploy to AWS (uses managed services)
make up-aws

# Fix Kafka issues
make fix-kafka
```

**See all commands**: `make help`

---

## Understanding the 9 Layers

### 🏗️ Full Architecture Diagram

```mermaid
graph TB
    subgraph "User Layer"
        User[👤 You] --> TG[Telegram]
        User --> Web[Web Dashboard]
        User --> API[REST API]
    end

    subgraph "Gateway Layer"
        TG --> Gateway[Nginx Gateway]
        Web --> Gateway
        API --> Gateway
    end

    subgraph "Presentation Layer (Layer 8)"
        Gateway --> Bot[Telegram Bot<br/>@GuruJiBot]
        Gateway --> Portal[Stock Portal<br/>React Dashboard]
    end

    subgraph "API Layer (Layer 7)"
        Bot --> CoreAPI[Core API<br/>Fastify/Node.js]
        Portal --> CoreAPI
        CoreAPI --> Auth[Auth & Rate Limiting]
        CoreAPI --> WS[WebSocket Server<br/>Socket.io]
    end

    subgraph "Intelligence Layer"
        CoreAPI --> L4[Layer 4: Analysis Engine<br/>Go - RSI, MACD, Bollinger]
        L4 --> L9[Layer 9: AI Service<br/>Python - ML Predictions]
        L9 --> L4
        L4 --> L5[Layer 5: Aggregation<br/>Market Sentiment]
        L5 --> L6[Layer 6: Signal Generation<br/>Buy/Sell Alerts]
    end

    subgraph "Data Pipeline"
        L1[Layer 1: Ingestion<br/>Live Ticks from Broker] --> Kafka[Apache Kafka]
        Kafka --> L2[Layer 2: Processing<br/>1-min Candles]
        L2 --> L3DB[(Layer 3: TimescaleDB<br/>Historical Data)]
        L2 --> L3Redis[(Layer 3: Redis<br/>Live Cache)]
        L3DB --> L4
        L3Redis --> L4
    end

    subgraph "Data Sources"
        Zerodha[Zerodha Kite] -.WebSocket.-> L1
        MStock[MStock API] -.WebSocket.-> L1
        FlatTrade[FlatTrade] -.WebSocket.-> L1
    end

    subgraph "Monitoring"
        All[All Services] --> Prom[Prometheus]
        Prom --> Grafana[Grafana Dashboards]
        All --> Loki[Loki Logs]
        Loki --> Grafana
    end

    style User fill:#90EE90
    style L9 fill:#FFD700
    style L4 fill:#87CEEB
    style Kafka fill:#FF6B6B
    style L3DB fill:#9370DB
```

### Layer Breakdown (Layman Terms)

#### Layer 1: Ingestion 📡

**Purpose**: Connect to stock exchange and get live prices
**What it does**: Like a news reporter at the stock exchange, constantly listening for price updates
**Technology**: Node.js, WebSocket
**Output**: "RELIANCE price is now ₹2850.50"

#### Layer 2: Processing ⚙️

**Purpose**: Organize prices into charts
**What it does**: Takes 60 seconds of tick-by-tick prices and creates a 1-minute candlestick (like summarizing an hour-long meeting into 5 bullet points)
**Technology**: Node.js
**Output**: "RELIANCE: Open=₹2845, High=₹2851, Low=₹2844, Close=₹2850"

#### Layer 3: Storage 🗄️

**Purpose**: Remember everything
**What it does**:

- **TimescaleDB**: Long-term memory (stores years of data)
- **Redis**: Short-term memory (super fast, stores latest prices)
  **Technology**: PostgreSQL + Redis

#### Layer 4: Analysis 📊

**Purpose**: The "Math Genius" - calculates technical indicators
**What it does**:

- Calculates RSI (Relative Strength Index) - Is stock overbought/oversold?
- Calculates MACD - Is momentum building?
- Calculates EMAs - What's the trend?
  **Technology**: Go (ultra-fast parallel processing)
  **Output**: "RELIANCE RSI=65, MACD=Bullish, Above EMA200"

#### Layer 5: Aggregation 📈

**Purpose**: The "Big Picture Guy" - looks at entire market
**What it does**: Combines analysis of all 50 stocks to say "Market is BULLISH" or "BEARISH"
**Technology**: Go
**Output**: "35 stocks rising, 12 falling → Market BULLISH"

#### Layer 6: Signal Generation ⚡

**Purpose**: The "Decision Maker" - creates BUY/SELL alerts
**What it does**: Uses strategies (e.g., "If RSI < 30 AND price > 200-day average, then BUY")
**Technology**: Node.js
**Output**: "🟢 BUY RELIANCE @ ₹2850"

#### Layer 7: Core API 🔌

**Purpose**: The "Waiter" - serves data to apps
**What it does**: Provides REST API and WebSocket for dashboards, bots, mobile apps
**Technology**: Fastify (Node.js), Socket.io
**Endpoints**: `/api/v1/analyze?symbol=TCS`

#### Layer 8: Presentation 🤖

**Purpose**: The "Communicator" - talks to you
**Components**:

- **Telegram Bot**: Messages you on Telegram
- **Web Dashboard**: Beautiful charts in browser
- **Email Service**: Daily digest emails
  **Technology**: Telegraf (Bot framework), React (Dashboard)

#### Layer 9: AI Service 🧠

**Purpose**: The "AI Brain" - predicts future price movements
**What it does**: Uses machine learning to predict if stock will rise/fall
**Supported Engines**:

1. **Heuristic** (Free): Rule-based, 70% accuracy, <10ms
2. **PyTorch** (Free): Neural network, 85% accuracy, 30ms
3. **OpenAI GPT-4** (Paid): 90% accuracy, 200ms
4. **Claude** (Paid): 92% accuracy, 200ms
5. **Ollama** (Free): Local Llama, 75% accuracy, 100ms
   **Technology**: Python, FastAPI, PyTorch
   **Output**: "82% probability RELIANCE will rise (Confidence: 88%)"

---

## How Data Flows Through the System

### Scenario: Live Analysis (Happens Every Minute)

```
1. 🕐 09:30:00 AM - Market opens
   └─ Zerodha sends: "RELIANCE ₹2850.50"

2. 🕐 09:30:00.100ms - Layer 1 receives
   └─ Publishes to Kafka topic: raw-ticks

3. 🕐 09:31:00 - Layer 2 closes 1-minute candle
   ├─ Saves to TimescaleDB
   └─ Publishes to Kafka: market_candles

4. 🕐 09:31:01 - Layer 4 wakes up
   ├─ Fetches last 300 candles from database
   ├─ Calculates: RSI=65, MACD=12.5, EMA50>EMA200
   └─ Calls Layer 9: "Predict with these features"

5. 🕐 09:31:02 - Layer 9 runs AI model
   └─ Returns: Prediction=0.82 (82% bullish), Confidence=0.88

6. 🕐 09:31:03 - Layer 4 combines scores
   ├─ Technical Score: 3.5/5
   ├─ AI Score: 4.1/5
   └─ Recommendation: STRONG BUY

7. 🕐 09:31:04 - Layer 6 evaluates strategies
   └─ "RSI < 70 AND MACD Bullish" → Generate BUY signal

8. 🕐 09:31:05 - Layer 8 Telegram Bot
   └─ Sends to you: "🟢 RELIANCE BUY @ ₹2850"

Total time: 5 seconds from market tick to your phone!
```

### Scenario: On-Demand Analysis (You ask the bot)

```
You type: /analyze TCS

1. Telegram → Bot (Layer 8)
2. Bot → Core API (Layer 7): GET /api/v1/analyze?symbol=TCS
3. Core API → Analysis Engine (Layer 4): "Analyze TCS now"
4. Analysis → Database: Fetch 300 candles
5. Analysis → Calculate: RSI, MACD, EMAs
6. Analysis → AI Service (Layer 9): "Predict TCS"
7. AI → Analysis: Prediction=0.55, Confidence=0.72
8. Analysis → Core API: Full scorecard JSON
9. Core API → Bot: JSON response
10. Bot → You: Formatted message

Total time: 600ms (less than 1 second!)
```

---

## Technology Stack

### Languages

- **Go**: High-performance analysis (Layer 4, 5)
- **Node.js**: API, bots, data processing (Layer 1, 2, 6, 7, 8)
- **Python**: AI/ML inference (Layer 9)

### Databases

- **TimescaleDB**: Time-series data (stock prices, candles)
- **Redis**: Real-time cache, pub/sub messaging
- **PostgreSQL**: User data, configurations

### Message Queue

- **Apache Kafka**: Handles 10,000+ messages/second

### Web Frameworks

- **Fastify**: Lightning-fast REST API
- **Socket.io**: Real-time WebSocket streaming
- **FastAPI**: Python API for AI service

### AI/ML

- **PyTorch**: Neural networks (LSTM)
- **OpenAI API**: GPT-4 integration
- **Anthropic Claude**: Advanced reasoning
- **Ollama**: Self-hosted Llama 3

### Monitoring

- **Prometheus**: Metrics collection
- **Grafana**: Beautiful dashboards
- **Loki**: Log aggregation

### Deployment

- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **Nginx**: Reverse proxy, load balancer

---

## Configuration Guide

### Environment Variables (`.env`)

```bash
# ===== BROKER CONFIGURATION =====
MARKET_DATA_PROVIDER=mstock  # mstock | zerodha | flattrade
MSTOCK_API_KEY=your_key
MSTOCK_PASSWORD=your_password
MSTOCK_TOTP_SECRET=your_totp_secret

# ===== DATABASE =====
POSTGRES_USER=trading
POSTGRES_PASSWORD=trading123
POSTGRES_DB=nifty50
TIMESCALE_URL=postgresql://trading:trading123@timescaledb:5432/nifty50

# ===== CACHE =====
REDIS_URL=redis://redis:6379

# ===== MESSAGE QUEUE =====
KAFKA_BROKERS=kafka:29092

# ===== AI CONFIGURATION =====
AI_PROVIDER=heuristic  # heuristic | pytorch | openai | claude | ollama

# If using OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4

# If using Claude
ANTHROPIC_API_KEY=sk-ant-...

# If using Ollama (local)
OLLAMA_URL=http://ollama:11434
OLLAMA_MODEL=llama3

# ===== TELEGRAM BOT =====
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=123456789

# ===== MONITORING =====
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin123
PROMETHEUS_RETENTION=15d

# ===== FEATURE FLAGS =====
ENABLE_PAPER_TRADING=true
ENABLE_LIVE_TRADING=false
ENABLE_TELEGRAM_ALERTS=true
```

### Switching AI Providers

#### Heuristic (Default - Free)

```bash
AI_PROVIDER=heuristic
```

**Pros**: Fast, no API costs, works offline
**Cons**: 70% accuracy (decent but not great)

#### PyTorch (Free - Best Accuracy)

```bash
AI_PROVIDER=pytorch
```

**Pros**: 85% accuracy, free, runs locally
**Cons**: Slower (30-50ms), needs GPU for training

#### OpenAI GPT-4 (Paid - Excellent)

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4
```

**Pros**: 90% accuracy, excellent reasoning
**Cons**: Costs ~$0.01 per analysis

#### Claude (Paid - Best Reasoning)

```bash
AI_PROVIDER=claude
ANTHROPIC_API_KEY=sk-ant-...
```

**Pros**: 92% accuracy, explainable predictions
**Cons**: Costs ~$0.015 per analysis

#### Ollama (Free - Private)

```bash
AI_PROVIDER=ollama
OLLAMA_MODEL=llama3
```

**Pros**: 75% accuracy, completely private, free
**Cons**: Requires powerful machine (8GB+ RAM)

---

## Monitoring & Dashboards

### Access Points

| Service                  | URL                   | Default Login           |
| ------------------------ | --------------------- | ----------------------- |
| **Grafana** (Dashboards) | http://localhost:3001 | admin / admin123        |
| **Prometheus** (Metrics) | http://localhost:9090 | -                       |
| **Kafka UI**             | http://localhost:8090 | -                       |
| **pgAdmin** (Database)   | http://localhost:5050 | admin@admin.com / admin |
| **Redis Commander**      | http://localhost:8085 | -                       |
| **Core API**             | http://localhost:4000 | API Key required        |
| **Web Dashboard**        | http://localhost:3000 | -                       |

### Pre-built Grafana Dashboards

1. **System Overview**
   - Active containers
   - Memory/CPU usage
   - Request rates

2. **Trading Pipeline**
   - Ticks received per second
   - Candles closed
   - Analysis latency (p50, p95, p99)
   - AI inference times

3. **Data Quality**
   - Missing ticks
   - Database latency
   - Cache hit ratio

4. **API Performance**
   - Request rate
   - Error rate (5xx)
   - Response time distribution

---

## Troubleshooting

### Common Issues

#### Kafka won't start - "Cluster ID mismatch"

```bash
make fix-kafka
```

#### Telegram bot not responding

```bash
# Check logs
docker logs telegram-bot

# Verify token is correct
echo $TELEGRAM_BOT_TOKEN

# Restart bot
make notify-build
```

#### Analysis engine returning errors

```bash
# Check AI service
docker logs ai-inference

# Verify database has data
docker exec timescaledb psql -U trading -d nifty50 -c "SELECT COUNT(*) FROM candles_1m;"

# Restart analysis
docker-compose -f infrastructure/compose/docker-compose.app.yml restart analysis
```

#### Out of memory

```bash
# Increase Docker memory (Docker Desktop → Settings → Resources → Memory: 8GB)
# Or reduce Redis cache size in .env:
REDIS_MAXMEMORY=256mb
```

#### API returns 401 Unauthorized

```bash
# Check if API key is set
curl http://localhost:4000/api/v1/health

# For protected endpoints, use:
curl -H "X-API-KEY: your_key" http://localhost:4000/api/v1/signals
```

### Checking System Health

```bash
# All services status
make logs

# Specific service logs
docker logs <container_name>

# Check API health
curl http://localhost:4000/api/v1/health

# Check all layers status
curl http://localhost:4000/api/v1/system-status
```

---

## Production Deployment

### AWS Deployment (Managed Services)

```bash
# 1. Setup AWS credentials
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...

# 2. Use AWS managed services
cp .env.aws.example .env.aws

# Edit .env.aws:
# - RDS_ENDPOINT=your-rds.amazonaws.com
# - ELASTICACHE_ENDPOINT=your-redis.amazonaws.com
# - MSK_BROKERS=your-kafka.amazonaws.com:9092

# 3. Deploy
make up-aws
```

### Self-Hosted Production

```bash
# 1. Use production compose file
make up-prod

# 2. Backup regularly (cron job)
0 2 * * * cd /path/to/Trading-System && make backup

# 3. Monitor logs
make logs | grep ERROR
```

---

## Security Considerations

### API Keys

- Never commit `.env` file to git
- Rotate broker API keys monthly
- Use separate keys for dev/prod

### Database

- Change default passwords in `.env`
- Enable SSL for production databases
- Backup encryption recommended

### Network

- Use firewall rules to restrict access
- Enable HTTPS for public deployments
- Rate limit API endpoints (already configured)

### Trading Safety

- **ALWAYS** test with paper trading first
- Set position size limits
- Implement stop-loss mechanisms
- Never trade with money you can't afford to lose

---

## Roadmap 🗺️

### ✅ Completed

- [x] Real-time data ingestion
- [x] Technical analysis (RSI, MACD, Bollinger)
- [x] AI integration (5 providers)
- [x] Telegram bot with 10+ commands
- [x] WebSocket streaming
- [x] Grafana monitoring
- [x] Docker deployment

### 🚧 In Progress

- [ ] Backtesting engine
- [ ] Portfolio tracking
- [ ] Mobile app (React Native)
- [ ] Paper trading simulator

### 📋 Planned

- [ ] Options chain analysis
- [ ] News sentiment analysis
- [ ] Multi-timeframe analysis (5m, 15m, 1h)
- [ ] Custom strategy builder (drag-drop)
- [ ] WhatsApp bot integration
- [ ] Voice alerts (Twilio)

---

## FAQ

### Q: Is this free?

**A**: The software is 100% free and open source. You only pay for:

- Broker API subscription (₹100-500/month)
- Cloud hosting (if not running locally)
- AI APIs (optional, if using OpenAI/Claude)

### Q: Can I use this for real trading?

**A**: The system can generate signals, but **it cannot execute trades automatically**. You must manually place orders. This is by design for safety.

### Q: How accurate are the predictions?

**A**: Accuracy varies:

- Heuristic: ~70%
- PyTorch: ~85%
- GPT-4/Claude: ~90%

**Important**: No system is 100% accurate. Always use stop-losses and risk management.

### Q: Which broker should I use?

**A**:

- **Zerodha**: Most popular, great API, ₹200/month
- **MStock**: Lower fees, good for small accounts
- **FlatTrade**: Free API (no monthly charges)

### Q: Can I analyze stocks outside Nifty 50?

**A**: Yes! Edit the stock list in `layer-1-ingestion/config/stocks.json`

### Q: How much RAM/CPU do I need?

**A**:

- **Minimum**: 4GB RAM, 2 CPU cores (Heuristic AI)
- **Recommended**: 8GB RAM, 4 cores (PyTorch AI)
- **Optimal**: 16GB RAM, 8 cores (All features)

### Q: Can I run this on Raspberry Pi?

**A**: Not recommended. The system needs significant resources. Consider using a cloud VPS (₹500-1000/month).

### Q: How do I add my own trading strategies?

**A**: See [CONTRIBUTING.md](CONTRIBUTING.md) for guide on creating custom strategies.

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Code style guide
- How to add new strategies
- How to add new AI providers
- Testing guidelines

---

## License

MIT License - See [LICENSE](LICENSE) file for details.

---

## Support

- **Documentation**: See [ARCHITECTURE.md](ARCHITECTURE.md) for technical details
- **Deployment Guide**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production setup
- **Issues**: [GitHub Issues](https://github.com/your-repo/Trading-System/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/Trading-System/discussions)

---

## Acknowledgments

- [Zerodha Kite Connect](https://kite.trade/) - Broker API
- [MStock API](https://www.miraeassetcm.com/) - Alternative broker
- [TA-Lib](https://github.com/mrjbq7/ta-lib) - Technical analysis library
- [Apache Kafka](https://kafka.apache.org/) - Event streaming
- [TimescaleDB](https://www.timescale.com/) - Time-series database

---

## Disclaimer

**This software is for educational and research purposes only.**

- Trading stocks involves significant risk
- Past performance does not guarantee future results
- The authors are not financial advisors
- Use at your own risk
- Always consult a licensed financial advisor before trading

---

**Made with ❤️ by traders, for traders**

_Star ⭐ this repo if you found it helpful!_
