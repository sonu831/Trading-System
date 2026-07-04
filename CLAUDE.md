# Trading-System — Claude Instructions

Nifty 50 algorithmic trading system: 9-layer event-driven microservices monorepo (Kafka, TimescaleDB, Redis).

## Repo Layout

| Directory | Layer | Tech | Purpose |
|-----------|-------|------|---------|
| `layer-1-ingestion` | 1 | Node.js | Live tick ingestion from brokers (Zerodha/MStock/FlatTrade) → Kafka |
| `layer-1-flattrade-python` | 1 | Python | FlatTrade broker adapter |
| `layer-1-tradingview` | 1b | Node.js | TradingView MCP server — AI chart analysis via CDP (see below) |
| `layer-2-processing` | 2 | Node.js | Tick → candle builder |
| `layer-3-storage` | 3 | TimescaleDB + Redis | Historical + real-time storage |
| `layer-4-analysis` | 4 | Go | Technical indicators (RSI, MACD, EMAs) |
| `layer-5-aggregation` | 5 | Go | Market-wide sentiment aggregation |
| `layer-6-signal` | 6 | Node.js | Buy/sell signal generation |
| `layer-7-core-interface` | 7 | Node.js | Fastify REST API + Socket.io gateway |
| `layer-8-presentation-notification` | 8 | Node.js/React | Telegram bot, web dashboard, email |
| `layer-9-ai-service` | 9 | Python | ML inference |
| `infrastructure` | — | Docker | Compose files, Kafka, observability (Prometheus/Grafana/Loki) |
| `shared` | — | — | Shared code and schemas |

## Common Commands

All orchestration is via the Makefile (`make help` lists everything):

- `make up` / `make down` — full stack up/down (infra, Kafka wait, services, UI)
- `make infra` — infrastructure only (Kafka, DBs, observability)
- `make dev` — infra + local dev mode; `make layer1`, `make layer2`, … run single layers
- `make test` — run tests; `make test-layer1` for layer-scoped
- `make backup` / `make restore` — database backup/restore
- `npm run lint` / `npm run format` — ESLint + Prettier (husky + lint-staged enforce on commit; Go files get `gofmt`)

## Layer 1b: TradingView MCP (`layer-1-tradingview`)

An MCP server (stdio) with 68 tools that reads and controls a live TradingView Desktop chart over CDP (port 9222). Registered in the root `.mcp.json`, so the `tradingview` MCP tools are available in Claude Code sessions here.

- **Full tool guide**: `layer-1-tradingview/CLAUDE.md` — decision tree for which tool to use, context-management rules, output-size table. Read it before using the tools.
- **Watchlist bias scans**: `layer-1-tradingview/rules.json` defines the watchlist, timeframes, and Bullish/Bearish/Neutral bias criteria; the "12 hr update" workflow in that CLAUDE.md drives it.
- **Setup**: `npm install` inside `layer-1-tradingview/` once; TradingView Desktop must be running with CDP enabled (`tv_launch` tool can start it).
- **Constraints**: not a streaming source — one symbol at a time, cannot run headless. It is an AI-assisted analysis / discretionary-signal input, NOT part of the tick pipeline (that's `layer-1-ingestion`).
- **Upstream**: subtree of https://github.com/sonu831/trading-view-bot — sync with `git subtree pull --prefix=layer-1-tradingview trading-view-bot main`.

## Conventions

- Event-driven: layers communicate via Kafka topics (`raw-ticks`, `market_candles`, `analysis_updates`); consumers must be idempotent
- CQRS: Redis for reads, TimescaleDB for writes
- PR workflow: feature branches → PR into `main`; do not push directly to `main`
- Architecture deep-dive: `ARCHITECTURE.md`; deployment: `DEPLOYMENT.md`
