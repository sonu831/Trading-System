# ARCHITECTURE.md — Three-Plane Trading Platform

> **Canonical.** This file and [`VISION.md`](VISION.md) are the two source-of-truth documents.
> Read `VISION.md` first (what/why); this is how it's built. Updated 2026-07-10.

## Three Planes

The system splits into three planes. Each has ONE responsibility; cross-plane communication is
strictly contract-based.

- **Control** — configuration and commands from the dashboard (no redeploy to change anything).
- **Data** — the live, low-latency streaming pipeline: market data → orders, on Kafka.
- **Research** — offline, batch, reproducible: mine 5 years of history, find analogs, validate
  strategies. This is where the "intelligence" is built; the Data plane only *runs* what Research
  validated. They share storage, never a code path.

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

### Research Plane — "What Happened Last Time?" (the reason the project exists)

Batch, offline, reproducible. Operates on the five-year candle history, NOT the live stream. Its
output is validated strategies + analog probabilities that the Data plane consumes — never the reverse.

```
TimescaleDB (5y candles_1m + aggregates, index_membership)
     │
     ▼
 feature builder ──► shape vectors (z-scored, multi-TF)  ──► k-NN analog index
     │                                                          │
     ▼                                                          ▼
 backtest + optimizer (scripts/backtest, SYNTHETIC pricing)   "nearest N historical windows to
     │                                                         now → empirical outcome distribution"
     ▼                                                          │
 promotion (human-gated) ──► strategy config (Control plane) ──┘──► advisory panel on dashboard
```

| Phase | What | Status |
|-------|------|--------|
| R1 | 5-year backfill service + `index_membership` loader (table ships empty) | **PLAN** |
| R2 | Feature builder: normalise windows to comparable shape vectors, per symbol/TF | **PLAN** |
| R3 | k-NN analog index + query ("40 closest analogs → 68% higher in 1h, median +0.4%") | **PLAN** |
| R4 | Backtest + optimizer over point-in-time-correct history (harness exists, `scripts/backtest`) | **PARTIAL** |
| R5 | k-NN query endpoint (L7 API) + advisory panel on `/scalp` | **PLAN** |

**Non-negotiables for this plane:**
- **Point-in-time correctness.** Constituents come from `index_members_asof(index, date)` (migration 007),
  never `instruments.is_nifty50`. No feature may read a bar from the future of its label.
- **Synthetic is labelled.** Backtest option P&L is Black-Scholes at constant IV — a strategy *ranking*,
  not a P&L forecast. Every result carries `synthetic: true`. See `scripts/backtest/option-simulator.ts`.
- **Advisory only.** A k-NN probability tints a decision; it is never, by itself, a hard trade trigger.

## Extensibility Contract

> This is the whole point of the layout: a new capability is **a new file plus one registry line**,
> with zero edits to the service that consumes it. If adding a broker/strategy/source forces you to
> edit the engine, the abstraction is wrong — fix the abstraction, not the caller.

### Adding a New Broker

1. Create `layer-7-core-interface/api/src/modules/broker/strategies/<broker>.ts`
2. Implement `BrokerAuthStrategy`: `id`, `requiredFields`, `authenticate()`, `ttlSeconds()`, `canAuthenticateUnattended()`
3. Register in `strategies/index.ts` → `STRATEGIES` map
4. **Nothing else changes** — the session service, API, and dashboard auto-detect it.
   The session token is written to `REDIS_KEYS.BROKER_SESSION(provider)` and read by L1/L10; the
   broker never logs in twice.

### Adding a New Strategy

1. Create `layer-6-signal/src/strategies/plugins/<strategy>.ts`
2. Extend `BaseStrategy`: `evaluateEntry()`, `managePosition()`
3. Register in `strategies/orchestrator.ts` built-in list
4. **Nothing else changes** — the router picks it up by tier + regime affinity

### Adding a New Data / Alt-Data Source

1. Create an adapter under `layer-1-ingestion/src/vendors/` implementing the relevant adapter kind
   (BrokerAdapter / MarketDataAdapter / AltDataAdapter).
2. Register it in the vendor factory + add a provider row (dashboard).
3. **Nothing else changes** — downstream sees only normalised Kafka topics. Alt-data is advisory:
   if it goes stale, trading continues on price + breadth (mark stale, don't stop).

### Adding a New API Endpoint

1. Create `layer-7-core-interface/api/src/modules/<name>/` (routes, controller, service, repository)
2. Register in `container.ts` (DI) + `index.ts` (Fastify route)
3. Schema in `schemas.ts` — Fastify validates + serializes.
   The dashboard's Backfill/Data panels already call `/api/v1/system/backfill/*` and `/api/v1/data/*`;
   those modules are still to be built (see the handoff).

### Adding a New Dashboard Page

1. Create `pages/<name>/index.tsx` (Next.js page router)
2. Import from typed hooks/ports (`@/hooks/*`) — organisms never `fetch` directly
3. Add Navbar link

## Technology Stack

| Layer | Language | Framework | Key Dependencies |
|-------|----------|-----------|-----------------|
| L1, L2, L6, L7, L10 | **Node.js 24** (TypeScript, run via **tsx**) | Express/Fastify | kafkajs, pg, redis, prisma\* |
| L4, L5 | Go 1.23 | net/http | pgx, go-redis, techan |
| L8 | Next.js | React | lightweight-charts, socket.io-client, Redux Toolkit |
| L9 | Python 3.11 | FastAPI | PyTorch, Ollama |
| Infra | Docker | Compose | Kafka, TimescaleDB, Redis, Prometheus, Grafana |

**Toolchain rules (2026-07-10):**
- **pnpm only.** `pnpm-lock.yaml` is committed; npm lockfiles are gitignored. Every Dockerfile and CI
  job runs `pnpm install --frozen-lockfile`. Each Node layer carries a `pnpm-workspace.yaml` with an
  `allowBuilds:` map (pnpm ≥ 11) so native postinstalls (esbuild via tsx, prisma) run non-interactively.
- **TypeScript runs via `tsx`, not `ts-node`.** ts-node breaks on TypeScript ≥ 7; tsx transpiles via
  esbuild and is version-independent. Entry: `node --import tsx src/index.ts`. `pnpm run typecheck`
  (tsc `--noEmit`) is a separate, currently-imperfect gate — see the handoff for the type-debt.
- **`shared/` import path.** Docker mounts `shared` at `/app/shared`; the local checkout has it at
  repo-root `shared/`. A relative path that resolves in one breaks in the other — this is a known wart,
  tracked in the handoff. `shared/constants.js` is plain CommonJS (typed by `constants.d.ts`); there is
  deliberately no `.ts` twin (enforced by `shared/tests/no-ts-js-twins.test.js`).
- \* **Prisma pinned to 6.x.** Prisma 7 removes `url` from the schema datasource and needs a driver
  adapter; that migration is deferred (handoff).

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

Counts are measured (2026-07-10), not claimed. Every one of these crashed on `MODULE_NOT_FOUND` at
the start of that day's recovery session — the migration had renamed source out from under the tests.

| Layer | Tests | Command | Status |
|-------|-------|---------|--------|
| shared | constants parity (Node↔Go) + no-ts/js-twins | `node shared/tests/*.test.js` | ✅ pass |
| L1 | flattrade URLs + IST expiry + SSOT | `pnpm run verify` | ✅ pass |
| L2 | 6 (candle aggregator + boundary regression) | `pnpm test` | ✅ 6/6 |
| L4 | Go indicators | `go test ./...` | ⚠️ not run (no Go locally) |
| L5 | Go breadth | `go test ./...` | ⚠️ not run (no Go locally) |
| L6 | 13 (regime indicators + TF-alignment regressions) | `pnpm test` | ✅ 13/13 |
| L10 | 91 asserts across 3 suites (paper, live, flattrade OMS) | `pnpm run verify` | ✅ 91/91 |
| L7 | broker auth (MStock A–D + registry) | `pnpm run verify:broker-auth` | 🟡 70/78 |
| backtest | OptionSimulator synthetic-pricing + rule-13 flags | `pnpm test` | ✅ 6/6 |

> **CI note:** `.github/workflows/ci.yml` runs `pnpm install --frozen-lockfile` then `pnpm test`,
> caching on each layer's `pnpm-lock.yaml`. Those lockfiles were gitignored until 2026-07-10, so the
> install failed before any test ran — a green pipeline that never executed a test. Fixed.
