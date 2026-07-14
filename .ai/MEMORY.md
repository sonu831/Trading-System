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

## ⚡ ACTIVE WORK ORDER (2026-07-11) — Wiring Gaps

**`docs/WIRING_GAPS_AND_FIXES.md` is the active, code-verified work order** for the realtime plane, command
fan-out, broker sessions, and DB schema. Every tool touching those areas MUST read it first and follow
`.ai/skills/wiring-gaps.md` **strictly**: graphify for every codebase query; channel/room/topic names only from
`shared/constants.js` (add `REDIS_CHANNELS` first); ONE WebSocket relay only; every fixed gap becomes a named
assertion in `scripts/verify-wiring.js`. Key verified facts: REST plane complete (~20 endpoints live); realtime
push mostly dead (2 competing relays; `market_ticks`/`option_chain_updates`/`execution:state`/`execution-events`
have no Redis publishers; `signals`≠`signals:trade`, `notifications`≠`notifications:execution`; only
`market-regime` live); `strategies-changed`/`risk-changed` have no consumers; broker sessions have no refresh
loop and expire silently at IST midnight; DB has dual schema authority (SQL = DDL owner, Prisma = introspect-only).
Trust map: old PROJECT_STATE.md retired; CHANGELOG.md = project state; `COCKPIT_BACKEND_PLAN.md` §4–§5 superseded.
**Document map: `docs/INDEX.md`** (every doc + trust level). **Session baton: `.ai/handoffs/` (newest file)** —
write one at every session end. **Execution entry point: `docs/MASTER_EXECUTION_PROMPT.md` → PHASE 0.**

## 🔐 Auth & Secrets Architecture (DECIDED 2026-07-13 — do not re-litigate)

**Credentials live in the DB, not `.env`.** Broker secrets are AES-256-GCM encrypted in `broker_credentials`,
managed from the dashboard. L1/L10 fetch them from L7 (`CredentialStore` / `CredentialProvider`) and hot-reload
on `providers-changed`. **L7 is the single gateway between every layer and the database.**

**Exactly THREE bootstrap secrets stay in `.env`** — they are the root of trust and *cannot* come from the DB,
because each is required to reach or decrypt it (this is a circular dependency, not a missing feature):
`DATABASE_URL`/`POSTGRES_PASSWORD` (opens the DB) · `CREDENTIAL_MASTER_KEY` (decrypts `broker_credentials`) ·
`INTERNAL_API_KEY` (authenticates callers to L7, which fronts the DB). Everything else belongs in the DB.

**L7 is DEFAULT-DENY** (GAP-J1, fixed 2026-07-13). Only `PUBLIC_API_ROUTES` (`/health`, `/metrics`,
`/documentation`, `/swagger`, `/`) are open; every other route requires `x-api-key`. A missing header is a 401 —
never "unauthenticated but allowed". The old hook authenticated *only if the header was present*, leaving
`GET /providers/:provider/credentials/decrypted` (plaintext broker secrets) and the kill switch wide open.
`INTERNAL_API_KEY` is presented by: the dashboard (server-side `src/middleware.ts`, never `NEXT_PUBLIC_*`),
L1 (**scoped** axios interceptor — a blanket header would leak the key to MStock/FlatTrade), L10 (explicit headers).
CORS is allow-listed via `DASHBOARD_ORIGINS` (was `*`). `backend-api` is bound to `127.0.0.1:4000` (was `0.0.0.0`).
**Do NOT use IP allow-listing:** Docker SNATs published-port traffic to the bridge gateway, so external clients and
the dashboard both appear as `172.x`. Next.js reads env from its OWN dir — local dev needs
`stock-analysis-portal/.env.local`; changing the middleware requires an image rebuild.

## Kafka Topics

| Topic | Producer | Consumer | Schema |
|-------|----------|----------|--------|
| `raw-ticks` | Layer 1 (Ingestion) | Layer 2 (Processing) | Market tick data |
| `market_candles` | Layer 2 (Processing) | Layer 3 (Storage), Layer 4 (Analysis) | OHLCV candles |
| `analysis_updates` | Layer 4 (Analysis) | Layer 5 (Aggregation), Layer 6 (Signal) | Indicator values |
| `sentiment_scores` | Layer 5 (Aggregation) | Layer 6 (Signal), Layer 7 (API) | Market-wide sentiment |
| `trade_signals` | Layer 6 (Signal) | Layer 7 (API), L8, **Layer 10** | Buy/sell signals (extended: tier, strategyId, regime, reasons) |
| `notifications` | Layer 7 (API), Layer 6 (Signal) | Layer 8 (Presentation) | User notifications |
| `option-chain` | **Layer 1 (OptionChainPoller)** | L4, L6, L10 | ATM±N option chain snapshot |
| `market-regime` | **Layer 6 (Regime Engine)** | L6 Router, L8, L10 | RegimeState (trend/strength/vol/phase/alignment) |
| `execution-events` | **Layer 10 (Execution)** | L7, L8, Storage | Order fills, rejects, exits, P&L |

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
| L6 | `layer-6-signal/` | Node.js | Signal generation + **Regime Engine** + **Strategy Framework** (pluggable strategies) |
| L7 | `layer-7-core-interface/` | Node.js | Fastify REST API + Socket.io |
| L8 | `layer-8-presentation-notification/` | Node.js/React | Telegram bot, dashboard, email |
| L9 | `layer-9-ai-service/` | Python | ML inference |
| **L10** | **`layer-10-execution/`** | **Node.js** | **Options execution engine (OMS, risk mgr, position mgr, journal)** |
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
- `TRADE_MODE` -- Execution mode: paper | shadow | live
- `EXECUTION_BROKER` -- flattrade | mstock
- `REGIME_*` -- Regime engine settings (poll interval, symbol)
- `OPTION_*` -- Option chain poller settings (poll interval, underlying)
- `SEBI_REGISTERED` -- Validation: SEBI algo registration confirmed
- `BROKER_RATE_LIMITS_CONFIRMED` -- Validation: broker rate limits checked

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

> _Last updated: 2026-07-09 (Phases A–F built)_
