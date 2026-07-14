# MEMORY.md — Working State

> **Session-level working memory.** Current focus, active tasks, recent changes. Fast-changing state.
> For durable decisions, see `.ai/MEMORY.md`. For architecture, see `CLAUDE.md`.

## Current Focus

- **Cockpit Backend Integration** — 17-tab cockpit wiring to L7 API. 85% backend-ready. New pages: orders, internals, regime, alerts.
- **DB-Backed Credentials** — All broker secrets in `broker_credentials` (AES-256-GCM). `.env` stripped of broker creds. L1/L10 auto-discover from L7 API.
- **Direct TOTP Login** — MStock SDK one-step login with user-provided TOTP code from dashboard.

## Quick Commands

```bash
npm run sync-ai          # Propagate ai-manifest.json to all tool spokes
npm run sync-ai-check    # Verify no drift (CI gate)
make up                  # Full stack (infra + app + UI)
make app-core            # Start L1 + L7 + L10
make infra               # Start data stores only
docker ps --format "table {{.Names}}\t{{.Label \"com.docker.compose.project\"}}"  # Verify unified project
```

## Recent Work

| Date | What | Agent |
|------|------|-------|
| 2026-07-11 | **Cockpit backend gaps closed**: orders endpoint, backtest proxy, alerts endpoint, Socket.io widened (5 rooms), broker status in system-status | commandcode |
| 2026-07-11 | **Cockpit frontend pages**: /orders, /internals, /regime, /alerts with API adapters + Redux slices | commandcode |
| 2026-07-11 | **Docker project unification**: all 11 containers under `trading-system` — updated `.ai/skills/docker.md` with mandatory `--project-name` rule | commandcode |
| 2026-07-10 | **DB-backed credential architecture**: eliminated .env broker creds, L10 CredentialProvider, direct TOTP login, unified BrokerForm, shared enums, auth-logger | commandcode |
| 2026-07-09 | Broker credential vault + provider registry implemented | system-architect |
| 2026-07-09 | Docker compose fixes (network, version-check, healthcheck) | devops-engineer |
| 2026-07-09 | AI workflow infrastructure initialized | system-architect |
| 2026-07-09 | **Momentum Module — Phases A–F built**: Data foundation (A), Regime Engine (B), Strategy Framework (C), Backtest + Optimizer (D), L10 Execution (E), Validation Roadmap (F) | opencode |

## Active Gaps / Known Issues

- **Predictions/AI** — gated behind Phase-0 breadth study. L9 model is an untrained stub. `/ai` page shows abstain state.
- **Heavyweight contributions** — needs per-constituent weight data in L5 Go enrichment.
- **Go services** (analysis L4, aggregation L5, signal L6) — failing on `go mod download` in Docker build (pre-existing proxy issue).
- **Dashboard rebuild** — pnpm workspace config needs fixing in Docker build to pick up new cockpit pages.

## Environment

- **OS**: Windows (Docker Desktop)
- **Docker**: All containers under unified `trading-system` project
- **Node.js**: 20 (backend-api), 24 (dashboard)
- **Active containers** (11): zookeeper, kafka, redis, timescaledb, kafka-ui, pgadmin, redis-commander, backend-api(L7), execution(L10), ingestion(L1), processing(L2)
