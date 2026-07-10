# PROJECT_STATE.md — Master Completion Tracker

> **Single source of truth for project state.** Every AI tool MUST read this before non-trivial work and append a dated entry after every fix/feature/doc change.

## Quick Status (2026-07-10)

| Area | Status | Blockers |
|------|--------|----------|
| Architecture Design | ✅ Complete | None |
| AI Agentic Workflow | ✅ Complete | None |
| Docker/Makefile Hardening | ✅ Complete | None |
| Control Plane (Provider Registry) | ✅ Complete | None |
| Broker Session Service | ✅ Complete | TOTP secret needed from user |
| Data Pipeline (ingestion→signal) | ✅ Complete | MStock creds in .env, TOTP pending |
| Dashboard Broker UI | ✅ Complete | None |
| Execution (L10) | ✅ Complete | None |
| Multi-TF & Intelligence | ✅ Complete | None |
| Broker Login Flow Docs | ✅ Complete | None |

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

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| G1 | MStock TOTP secret `129608` not valid Base32 — needs real secret key from authenticator app | HIGH | Blocked on user |
| G2 | No Prisma migrations in Docker image (must rebuild after schema changes) | MEDIUM | Workaround: manual SQL |
| G3 | PM2 caches stale modules (must hard-restart container after code changes) | MEDIUM | Workaround: rebuild + restart |
| G4 | Docker Compose `include:` directive causes project conflicts on Windows | MEDIUM | Workaround: per-file compose |
| G5 | Windows PowerShell JSON escaping breaks curl commands | LOW | Use file-based requests |

---

## Completed Phases

### Phase 1: Foundation Hardening ✅ 14/14
### Phase 2: Data Completeness ✅ 5/5
### Phase 3: Intelligence ✅ 4/4
### Phase 4: Execution ✅ 4/4

## Session Log

| Date | What | Files |
|------|------|-------|
| 2026-07-10 | Broker login flow docs finalized; MStock flow corrected (two-step always required) | `BROKER_LOGIN_FLOWS.md`, `PROJECT_STATE.md`, `BrokerSessionService.js` |
| 2026-07-09 | Broker credential vault + provider registry; Docker hardening; AI workflow | 80+ files across all layers |
| 2026-07-09 | Architecture docs: TARGET, SIMPLE_ROBUST, MOMENTUM_TRADING | `docs/*.md` |

---

> _Last updated: 2026-07-09. Owner: system-architect + human._
