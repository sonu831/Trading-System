# `.ai/MEMORY.md` -- Canonical Project Memory

> **Single source of truth** for architecture decisions, tool config, naming conventions, and env-var contracts. Every AI tool reads this.

## Quick Reference

| Item | Detail |
|------|--------|
| Project | Nifty 50 Algorithmic Trading System |
| Architecture | 9-layer event-driven microservices |
| Message broker | Apache Kafka |
| Primary DB | TimescaleDB (PostgreSQL hypertables) |
| Cache | Redis |
| Languages | Node.js, Go, Python |
| Orchestration | Docker Compose + Makefile |

## Non-Negotiable Rules

1. **Graphify-first** -- query `graphify-out/` before raw grep for codebase exploration
2. **RTK for all commands** -- prefix every shell command with `rtk` for token optimization
3. **Shared-tier dedup** -- cross-layer constants/enums/types in `shared/`
4. **Event-driven contracts** -- layers talk ONLY via Kafka; consumers must be idempotent
5. **CQRS database access** -- Redis for reads, TimescaleDB for writes
6. **No hardcoded secrets** -- env vars only, `.env.example` as template
7. **PR workflow** -- feature branches -> PR into main, conventional commits
8. **Language conventions** -- ESLint/Prettier (JS), gofmt (Go), Black/ruff (Python)
9. **No git writes** -- don't commit/push without explicit owner instruction
10. **Hand-off on exit** -- every report ends with `## Hand-off` section

## Kafka Topics

| Topic | Producer | Consumer | Schema |
|-------|----------|----------|--------|
| `raw-ticks` | Layer 1 (Ingestion) | Layer 2 (Processing) | Market tick data |
| `market_candles` | Layer 2 (Processing) | Layer 3 (Storage), Layer 4 (Analysis) | OHLCV candles |
| `analysis_updates` | Layer 4 (Analysis) | Layer 5 (Aggregation), Layer 6 (Signal) | Indicator values |
| `sentiment_scores` | Layer 5 (Aggregation) | Layer 6 (Signal), Layer 7 (API) | Market-wide sentiment |
| `trade_signals` | Layer 6 (Signal) | Layer 7 (API), Layer 8 (Presentation) | Buy/sell signals |
| `notifications` | Layer 7 (API), Layer 6 (Signal) | Layer 8 (Presentation) | User notifications |

## Database Architecture (CQRS)

- **Write path:** Layer 3 -> TimescaleDB (hypertables with automatic partitioning)
- **Read path:** Layer 3 -> Redis (cached market data, latest values)
- **Materialized views:** Continuous aggregates in TimescaleDB for OHLCV rollups
- **Compression:** Enabled on hypertables older than 7 days

## Layer Map

| Layer | Directory | Language | Responsibility |
|-------|-----------|----------|----------------|
| L1 | `layer-1-ingestion/` | Node.js | Live tick ingestion from brokers |
| L1b | `layer-1-flattrade-python/` | Python | FlatTrade broker adapter |
| L1c | `layer-1-tradingview/` | Node.js | TradingView MCP server (AI chart analysis) |
| L2 | `layer-2-processing/` | Node.js | Tick -> candle builder |
| L3 | `layer-3-storage/` | TimescaleDB + Redis | Historical + real-time storage |
| L4 | `layer-4-analysis/` | Go | Technical indicators (RSI, MACD, EMAs) |
| L5 | `layer-5-aggregation/` | Go | Market-wide sentiment aggregation |
| L6 | `layer-6-signal/` | Node.js | Buy/sell signal generation |
| L7 | `layer-7-core-interface/` | Node.js | Fastify REST API + Socket.io |
| L8 | `layer-8-presentation-notification/` | Node.js/React | Telegram bot, dashboard, email |
| L9 | `layer-9-ai-service/` | Python | ML inference |
| Infra | `infrastructure/` | Docker | Kafka, Prometheus, Grafana, Loki |
| Shared | `shared/` | -- | Schemas, constants, types |

## Key Architecture Decisions

1. **Event-driven over REST for inter-service** -- Kafka decouples layers; each scales independently
2. **CQRS for market data** -- Redis handles high-frequency reads; TimescaleDB for historical analysis
3. **Polyglot persistence** -- Go for compute-heavy analysis (L4, L5), Node.js for I/O-heavy (L1-L3, L6-L8), Python for ML (L9)
4. **TradingView MCP for AI-assisted analysis** -- Not part of tick pipeline; discretionary/analyst workflow
5. **Docker Compose for dev; Swarm/K8s for prod** -- See DEPLOYMENT.md

## Environment Variable Contract

All secrets must be set in `.env` (git-ignored). Template: `.env.example`. Key groups:
- `MSTOCK_*` / `ZERODHA_*` / `FLATTRADE_*` -- Broker API credentials
- `KAFKA_*` -- Kafka bootstrap servers, SASL config
- `TIMESCALEDB_*` / `POSTGRES_*` -- Database connection
- `REDIS_*` -- Redis connection
- `SWARM_CONCURRENCY` -- Layer 1 worker pool size

## Build & Test Commands

- `make up` / `make down` -- Full stack
- `make infra` -- Infra only (Kafka, DBs)
- `make test` -- All tests
- `make test-layer<N>` -- Layer-scoped tests
- `npm run lint` / `npm run format` -- JS linting (ESLint + Prettier)
- `make backup` / `make restore` -- DB backup/restore

## Agent System

12 specialist agents in `.ai/agents/`:
- **market-strategist** -- Trading strategy, market analysis, roadmap
- **system-architect** -- Architecture decisions, layer boundaries, contracts
- **ingestion-specialist** -- Layer 1 (broker adapters, tick ingestion)
- **processing-engineer** -- Layer 2 (tick processing, candle building)
- **storage-engineer** -- Layer 3 (TimescaleDB, Redis, schemas)
- **technical-analyst** -- Layer 4 (Go indicators: RSI, MACD, EMAs)
- **sentiment-aggregator** -- Layer 5 (Go aggregation, market-wide sentiment)
- **signal-engineer** -- Layer 6 (buy/sell signals, strategy execution)
- **api-gateway-engineer** -- Layer 7 (Fastify REST + Socket.io gateway)
- **presentation-specialist** -- Layer 8 (Telegram, web dashboard, email)
- **ai-ml-engineer** -- Layer 9 (Python ML inference, model training)
- **devops-engineer** -- Infrastructure (Docker, Kafka, monitoring)
- **quality-gatekeeper** -- Linting, testing, code quality across all layers

## Knowledge Base

- **Knowledge graph:** `graphify-out/` -- query via `graphify query/explain/path`
- **Architecture deep-dive:** `ARCHITECTURE.md`
- **Database schema:** `docs/DATABASE_SCHEMA.md`
- **Deployment guide:** `DEPLOYMENT.md`
- **Contributing guide:** `CONTRIBUTING.md`

> _Last updated: 2026-07-09_
