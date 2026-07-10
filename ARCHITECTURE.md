# ARCHITECTURE.md — Three-Plane Trading Platform

> **Canonical architecture document.** Updated 2026-07-10.

## Three Planes

The system splits into three planes. Each plane has ONE responsibility. Cross-plane communication is strictly contract-based.

### Control Plane — "Configure Everything from the Dashboard"

```
Dashboard (L8) → REST API (L7) → Config DB (TimescaleDB) + Command Bus (Redis)
```

| Concern | Mechanism | Effect |
|---------|-----------|--------|
| Providers | `broker_providers` table + `broker_credentials` (encrypted) | Add/edit/enable/disable/prioritize from dashboard |
| Strategies | `strategies:config` Redis key | Enable/disable/tune at runtime |
| Risk | `risk:config` Redis key | Limits, sizing, cutoffs |
| Mode | `execution:state` Redis key | paper → shadow → live |
| Kill Switch | `execution:kill_switch` (Redis persisted) | Halts entries, flattens positions |

**Extensibility contract:** Adding a provider = add a strategy file in `broker/strategies/` + register in the index. Nothing else changes.

### Data Plane — "Market Data → Orders on Kafka"

```
L1 → L2 → L4 → L5 → L6 → L10
(Node) (Node) (Go) (Go) (Node) (Node)
  │                              │
  └──── L3 (TimescaleDB+Redis) ──┘
```

| Layer | One Job | In | Out |
|-------|---------|----|-----|
| **L1 Ingestion** | Single broker data gateway | Broker WS/REST | `raw-ticks`, `option-chain` |
| **L2 Processing** | Tick → 1m OHLCV candles | `raw-ticks` | `candles_1m`, Redis cache |
| **L3 Storage** | TimescaleDB writes + Redis reads (CQRS) | `market_candles` | DB + Redis |
| **L4 Analysis** | Indicators: RSI, MACD, EMA, ADX, ATR | `candles_1m` | `analysis_updates` |
| **L5 Aggregation** | Breadth, sector rotation, VIX | `analysis_updates` | `sentiment_scores` |
| **L6 Signal** | Regime engine + strategy framework | `analysis_updates` + `sentiment_scores` | `trade_signals` |
| **L7 Core API** | REST + WebSocket + Broker vault | Kafka + Redis | HTTP/WS |
| **L8 Dashboard** | `/scalp` cockpit + broker settings | HTTP/WS | Browser |
| **L9 AI** | ML inference (heuristic, PyTorch, Ollama) | HTTP → L4 features | predictions |
| **L10 Execution** | Order gateway: risk → strike → OMS → position | `trade_signals` | Broker orders |

**Rules:**
- Layers communicate ONLY via Kafka
- Consumers MUST be idempotent (ON CONFLICT DO NOTHING)
- One source of truth per constant (`shared/`)
- No direct DB from L1/L2 (CQRS)

### Research Plane — "What Happened Last Time?"

```
L6 Regime → TimescaleDB (regime_snapshots) → k-NN Search → Dashboard
```

| Phase | What | Status |
|-------|------|--------|
| R1 | Store regime snapshots to DB on every evaluation | PLAN |
| R2 | k-NN query endpoint (L7 API) | PLAN |
| R3 | Dashboard panel on `/scalp` | PLAN |
| R4 | Auto-label snapshots with trade outcomes | PLAN |

**Rule:** Advisory only. Never a hard trade trigger.

## Extensibility Contract

### Adding a New Broker

1. Create `layer-7-core-interface/api/src/modules/broker/strategies/<broker>.js`
2. Implement `BrokerAuthStrategy`: `id`, `requiredFields`, `authenticate()`, `ttlSeconds()`, `canAuthenticateUnattended()`
3. Register in `strategies/index.js` → `STRATEGIES` map
4. **Nothing else changes** — the session service, API, and dashboard auto-detect it

### Adding a New Strategy

1. Create `layer-6-signal/src/strategies/plugins/<strategy>.js`
2. Extend `BaseStrategy`: `evaluateEntry()`, `managePosition()`
3. Register in `strategies/orchestrator.js` built-in list
4. **Nothing else changes** — the router picks it up by tier + regime affinity

### Adding a New API Endpoint

1. Create `layer-7-core-interface/api/src/modules/<name>/` (routes, controller, service, repository)
2. Register in `container.js` (DI) + `index.js` (Fastify route)
3. Schema in `schemas.js` — Fastify validates + serializes

### Adding a New Dashboard Page

1. Create `pages/<name>/index.tsx` (Next.js page router)
2. Import from `@/hooks/useMarket` (typed ports — never fetch directly)
3. Add Navbar link

## Technology Stack

| Layer | Language | Framework | Key Dependencies |
|-------|----------|-----------|-----------------|
| L1, L2, L6, L7, L10 | Node.js 20 | Express/Fastify | kafkajs, pg, redis, prisma |
| L4, L5 | Go 1.23 | net/http | pgx, go-redis, techan |
| L8 | Next.js 13 | React 18 | lightweight-charts, socket.io-client, Redux Toolkit |
| L9 | Python 3.11 | FastAPI | PyTorch, Ollama |
| Infra | Docker | Compose | Kafka, TimescaleDB, Redis, Prometheus, Grafana |

## Communication

```
L1 → Kafka:raw-ticks → L2 → Kafka:market_candles → L3(write) + L4(read)
L4 → Redis:analysis_updates → L5 → Redis:sentiment_scores → L6 → Kafka:trade_signals → L10
L3 → Redis (read path) → L7 (API) → HTTP/WS → L8 (Dashboard)
```

**Kafka guarantees:** `maxInFlightRequests: 1`, manual commits after success, idempotent consumers.

## Security

| Layer | Mechanism |
|-------|-----------|
| Credentials | AES-256-GCM encrypted in `broker_credentials` (master key from env) |
| TLS | Enabled at runtime (NODE_TLS_REJECT_UNAUTHORIZED removed) |
| Secrets | Never in code/images. `.env` for bootstrap only |
| Docker | Non-root USER, tini init, HEALTHCHECK, log rotation |

## Testing

| Layer | Tests | Command |
|-------|-------|---------|
| L2 | 4 (candle aggregator) | `npm test` |
| L4 | 10 (Go indicators) | `go test ./...` |
| L5 | 7 (Go breadth) | `go test ./...` |
| L6 | 10 (regime indicators) | `npm test` |
| L10 | 3 suites (paper, live, OMS) | `npm run verify` |
| L7 | 2 (broker auth, execution proxy) | `npm run verify` |
