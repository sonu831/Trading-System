# PROJECT_STATE.md — Master Completion Tracker

> **Single source of truth for project state.** Every AI tool MUST read this before non-trivial work and append a dated entry after every fix/feature/doc change. A session without an entry here did not happen.

## Quick Status (2026-07-09)

| Area | Status | Blockers |
|------|--------|----------|
| Architecture Design | 4 docs complete | None |
| AI Agentic Workflow | Complete | None |
| Docker/Makefile Hardening | Complete | None |
| Control Plane (Provider Registry) | API built, migration needed | `npx prisma migrate dev` pending |
| Broker Session Service | Not started | Depends on migration |
| Data Pipeline (ingestion→signal) | Running, no creds | Needs broker credentials |
| Dashboard UI (broker settings) | Not started | Depends on API |
| Execution (L10) | Scaffolded | Needs finishing |

---

## Master Completion Tracker

### Phase 1: Foundation Hardening (CURRENT)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 1.1 | Network persistence fix (Makefile) | DONE | devops-engineer |
| 1.2 | Version check robustness | DONE | devops-engineer |
| 1.3 | Backend API HEALTHCHECK fix | DONE | devops-engineer |
| 1.4 | PgAdmin Windows mount fix | DONE | devops-engineer |
| 1.5 | `broker_providers` + `broker_credentials` + `broker_sessions` schema | DONE | storage-engineer |
| 1.6 | Encryption utility (AES-256-GCM) | DONE | api-gateway-engineer |
| 1.7 | Provider CRUD API endpoints | DONE | api-gateway-engineer |
| 1.8 | Credential save endpoint (encrypted) | DONE | api-gateway-engineer |
| 1.9 | **Run Prisma migration** | DONE | storage-engineer |
| 1.10 | **Broker Session Service (MStock login from L7)** | DONE | api-gateway-engineer |
| 1.11 | **VendorManager reads from provider registry** | DONE | ingestion-specialist |
| 1.12 | **Dashboard broker settings UI page** | DONE | presentation-specialist |
| 1.13 | TLS hardening (remove NODE_TLS_REJECT_UNAUTHORIZED=0) | DONE | devops-engineer |
| 1.14 | Fix credential log leaks (F4: TOTP code in logs) | DONE | ingestion-specialist |

### Phase 2: Data Completeness (IN PROGRESS)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 2.1 | Verify option chain ingestion | IN PROGRESS | ingestion-specialist |
| 2.2 | India VIX data source | DONE | ingestion-specialist |
| 2.3 | MarketDataAdapter interface | DONE | ingestion-specialist |
| 2.4 | AltDataAdapter (FII/DII, PCR, news scrapers) | DONE | ingestion-specialist |
| 2.5 | Verify index multi-TF candle pipeline end-to-end | TODO | processing-engineer |

### Phase 3: Intelligence (IN PROGRESS)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 3.1 | Multi-TF regime engine (L5/L6) | EXISTS | sentiment-aggregator |
| 3.2 | Options analytics (IV rank, OI buildup, PCR, max-pain) | IN PROGRESS | technical-analyst |
| 3.3 | Adaptive strategy framework (L6) | EXISTS | signal-engineer |
| 3.4 | Backtest + optimizer (L9) | DONE | ai-ml-engineer |

#### Intelligence -- Newly Built

| # | What | File |
|---|------|------|
| - | Shared regime enums (JS + Go) | `shared/constants.js`, `shared/constants.go` |
| - | ADX + Ichimoku indicators (L4 Go) | `layer-4-analysis/internal/indicators/indicators.go` |
| - | Backtest engine (L9 Python) | `layer-9-ai-service/app/core/backtest.py` |
| - | Backtest API endpoints | `layer-9-ai-service/app/main.py` (+ `/backtest`, `/backtest/compare`, `/backtest/best`) |

### Phase 4: Execution (DONE)

| # | Task | Status | Agent |
|---|------|--------|-------|
| 4.1 | Finish L10 OMS (paper→shadow→live) | DONE | signal-engineer |
| 4.2 | FlatTrade-first order routing with failover | DONE | signal-engineer |
| 4.3 | Positional profile (overnight, gap-aware, long-premium only) | DONE | signal-engineer |
| 4.4 | Kill switch + manual square-off | DONE | signal-engineer |

#### Execution -- Newly Built

| # | What | File |
|---|------|------|
| - | LiveExecutor (broker orders + atomic SL + ordertag) | `layer-10-execution/src/live-executor.js` |
| - | Execution events Kafka producer | `layer-10-execution/src/index.js` (+ createKafkaProducer) |
| - | Redis notification publishing | `layer-10-execution/src/index.js` (reconcile loop) |
| - | Port fix (8090→8095, kafka-ui conflict) | `docker-compose.app.yml` + `Dockerfile` |
| - | Dockerfile node-healthcheck | `layer-10-execution/Dockerfile`

---

## Architecture Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-09 | Control Plane / Data Plane split | Dashboard controls config; Kafka pipeline is data. No redeploy needed for provider/strategy changes. |
| 2026-07-09 | 3 adapter kinds (Broker/MarketData/AltData) | One abstraction for all data sources; downstream is source-agnostic. |
| 2026-07-09 | Scraped data is advisory only | Fragile sources must not block trading. System degrades gracefully. |
| 2026-07-09 | Centralized Broker Session Service in L7 | One login, one token, one refresh loop. L1/L10 are passive consumers. |
| 2026-07-09 | Two broker touchpoints only (L1 data, L10 orders) | Simplicity + single gateway rule. |
| 2026-07-09 | Credential vault with AES-256-GCM encryption | Secrets never in env/code/images. CREDENTIAL_MASTER_KEY for dev; KMS for prod. |

---

## Known Gaps & Issues

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| G1 | No Prisma migrations exist (tables not created) | CRITICAL | `npx prisma migrate dev --create-only` |
| G2 | Ingestion uses env vars, not registry | HIGH | Wire VendorManager to DB + Redis |
| G3 | TOTP codes logged in mstock.js | HIGH | **FIXED** -- Logs now hidden |
| G4 | NODE_TLS_REJECT_UNAUTHORIZED=0 in Dockerfile | HIGH | **FIXED** -- Removed from ingestion Dockerfile |
| G5 | No dashboard UI for broker management | MEDIUM | Build /settings/broker page |

---

> _Last updated: 2026-07-09. Owner: system-architect + human._
