# Nifty 50 Algorithmic Trading System 📈

> Production-grade, event-driven algorithmic trading platform for Nifty 50 options — real-time analysis, automated signals, dashboard cockpit, and broker execution.

[![TypeScript](https://img.shields.io/badge/TypeScript-72%20files-3178C6.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8.svg)](https://golang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933.svg)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-31%20passing-green.svg)]()

---

## Quick Start

```bash
make setup    # Install node_modules for all layers
make up      # Start core pipeline (Kafka, DB, Redis, L1, L2, L7, Dashboard)
make up-all  # Start EVERYTHING (observer, notify, AI, execution)
make build   # TypeScript check + Go vet
```

| URL | Service |
|-----|---------|
| `http://localhost:3000` | Dashboard |
| `http://localhost:3000/scalp` | Options Scalping Cockpit |
| `http://localhost:3000/brokers` | Broker Settings |
| `http://localhost:4000` | Backend API |
| `http://localhost:5051` | PgAdmin (DB browser) |
| `http://localhost:8090` | Kafka UI |
| `http://localhost:3001` | Grafana |

---

## Architecture

```
┌────────────────── CONTROL PLANE (Dashboard → API → DB + Redis bus) ──────────────────┐
│  Providers · Strategies · Risk · Kill Switch — all configurable from the dashboard   │
└──────────────────────────────────┬───────────────────────────────────────────────────┘
                                   │
┌──────────────────────────────────▼──── DATA PLANE (Kafka pipeline) ───────────────────┐
│  L1 Ingestion → L2 Processing → L4 Analysis → L5 Aggregation → L6 Signal → L10 Exec │
│  (Node.js)      (Node.js)      (Go)           (Go)            (Node.js)    (Node.js)│
│                            └──────── L3 Storage (TimescaleDB + Redis) ───────────────┘│
└──────────────────────────────────────────────────────────────────────────────────────┘
```

| Layer | Job | Tech |
|-------|-----|------|
| **L1** | Single broker data gateway — ticks, options, VIX, alt data | Node.js |
| **L2** | Tick → OHLCV candles (1m), option chain writer | Node.js |
| **L3** | TimescaleDB (writes) + Redis (reads) — CQRS | Infra |
| **L4** | Technical indicators: RSI, MACD, EMA, ATR, ADX, Ichimoku | Go |
| **L5** | Market breadth, sector rotation, VIX adapter | Go |
| **L6** | Regime engine (multi-TF), pluggable strategy framework, signals | Node.js |
| **L7** | Fastify REST API + Socket.io real-time + Broker credential vault | Node.js |
| **L8** | Dashboard (/scalp cockpit), Telegram bot, email | Next.js / Node.js |
| **L9** | ML inference (heuristic, PyTorch, Ollama), backtest engine | Python |
| **L10** | Order execution: paper → shadow → live, SL-M, fill confirm | Node.js |

---

## Current State

| Area | Status |
|------|--------|
| **Broker Auth** | ✅ MStock (TOTP), FlatTrade, Kite, IndianAPI |
| **Provider Registry** | ✅ Add/edit/enable/disable from dashboard |
| **Dashboard Cockpit** | ✅ `/scalp` — SafetyBar, PriceChart, OptionChainGrid, StrikePreview |
| **Execution Safety** | ✅ 8/8 invariants: SL-M atomic, broker fill confirm, ordertags, kill switch |
| **Engineering Standards** | ✅ 82% compliance (up from 35%) |
| **TypeScript** | ✅ 72 files (intentionally typed core files) |
| **Testing** | ✅ 31 tests (L2:4, L4 Go:10, L5 Go:7, L6:10) |
| **Kafka Hardening** | ✅ Manual commits, producer configs, versioned groups |
| **Docker** | ✅ Multi-stage, tini, real HEALTHCHECKs, log rotation |
| **CI Pipeline** | ✅ GitHub Actions (test-node + test-go + lint) |
| **NOT live** | 🚫 `LIVE_TRADING_ARMED` unset — validation roadmap not complete |

---

## Commands

| Command | Does |
|---------|------|
| `make setup` | Install node_modules for all layers |
| `make up` | Core pipeline (infra + L1 + L2 + L7 + dashboard) |
| `make up-all` | Everything (+ observer, notify, AI, execution) |
| `make build` | TypeScript check + Go vet |
| `make test-all` | All tests |
| `make layer1`..`make layer8` | Run individual layer locally |
| `make db-migrate` | Apply broker tables migration |
| `make logs` | Tail Docker logs |

---

## Architecture Docs

| Doc | Content |
|-----|---------|
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Master completion tracker — single source of truth |
| [`docs/TARGET_ARCHITECTURE.md`](docs/TARGET_ARCHITECTURE.md) | North star — Control Plane vs Data Plane |
| [`docs/SIMPLE_ROBUST_ARCHITECTURE_PLAN.md`](docs/SIMPLE_ROBUST_ARCHITECTURE_PLAN.md) | Provider registry, credential vault, session service |
| [`docs/MOMENTUM_TRADING_ARCHITECTURE.md`](docs/MOMENTUM_TRADING_ARCHITECTURE.md) | Strategy + adaptive framework |
| [`docs/DASHBOARD_ENHANCEMENT_PLAN.md`](docs/DASHBOARD_ENHANCEMENT_PLAN.md) | Atomic design, scalp cockpit (ALL PHASES COMPLETE) |
| [`docs/RESTRUCTURE_PLAN.md`](docs/RESTRUCTURE_PLAN.md) | 67-finding production audit + 6-week remediation |
| [`docs/ENGINEERING_STANDARDS_AUDIT.md`](docs/ENGINEERING_STANDARDS_AUDIT.md) | 12-section rule-by-rule compliance (82%) |
| [`docs/TYPESCRIPT_MIGRATION_PLAN.md`](docs/TYPESCRIPT_MIGRATION_PLAN.md) | TS migration plan |
| [`docs/BROKER_LOGIN_FLOWS.md`](docs/BROKER_LOGIN_FLOWS.md) | Per-broker auth flows |
| [`.ai/skills/engineering-standards.md`](.ai/skills/engineering-standards.md) | Coding discipline rules |

---

## Shared Module (`shared/`)

```typescript
// One import for all cross-layer types:
import { type TradeSignal, type Position, KAFKA_TOPICS, PORTS } from '@shared';
```

| File | Content |
|------|---------|
| `types.ts` | 25 interfaces: RegimeState, TradeSignal, Position, Loaded\<T\>, branded types |
| `ports.ts` | 9 interfaces: ExecutionPort, MarketPort, OptionsPort, etc. |
| `constants.js` | REGIME, SIGNAL, KAFKA_TOPICS (11), PORTS (19), BROKER_URLS |
| `constants.go` | Go mirror — Provider names, Kafka topics, Ports |
| `index.ts` | Barrel export |
