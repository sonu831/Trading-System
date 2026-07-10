# Nifty 50 Algorithmic Trading System 📈

> Production-grade, three-plane event-driven algorithmic trading platform. Real-time analysis, automated signals, dashboard cockpit, broker execution. All controllable from a single page.

[![Tests](https://img.shields.io/badge/Tests-31%20passing-green.svg)]()
[![Audit](https://img.shields.io/badge/Audit-82%25-brightgreen.svg)]()
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)]()
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8.svg)]()
[![Node.js](https://img.shields.io/badge/Node.js-20-339933.svg)]()

---

## Quick Start

```bash
make setup    # Install all dependencies (Node.js + Go + Python)
make up       # Purge cache → infra → build → start (L1+L2+L7+Dashboard)
make up-all   # Everything (+ observer, notify, AI, execution)
```

| URL | Service |
|-----|---------|
| `http://localhost:3000/scalp` | ⚡ Options Scalping Cockpit |
| `http://localhost:3000/brokers` | 🔑 Broker Credentials |
| `http://localhost:4000` | Backend API |
| `http://localhost:8090` | Kafka UI |
| `http://localhost:5051` | PgAdmin |

---

## Three-Plane Architecture

```
┌─────────────────── CONTROL PLANE ───────────────────┐
│  Dashboard → API → Config DB + Redis Command Bus     │
│  Providers · Strategies · Risk · Kill Switch         │
│  "Configure everything from the browser"             │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼──────── DATA PLANE ───────────┐
│  L1 → L2 → L4 → L5 → L6 → L10    (Kafka pipeline)   │
│  Node.js  Go   Go   Node.js  Node.js                 │
│            └──── L3 (TimescaleDB + Redis) ──────────┘│
│  "Market data flows left to right. One job per layer"│
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼─────── RESEARCH PLANE ────────┐
│  Regime DB → k-NN Analog Search → Dashboard          │
│  "What happened last time the market looked like this?"│
│  PLAN — advisory only, never a hard trigger          │
└──────────────────────────────────────────────────────┘
```

| Layer | One Job | Tech |
|-------|---------|------|
| **L1** | Broker data gateway — ticks, options, VIX, alt data | Node.js |
| **L2** | Tick → 1m OHLCV candles + option chain writer | Node.js |
| **L3** | TimescaleDB (writes) + Redis (reads) — CQRS | Infra |
| **L4** | Indicators: RSI, MACD, EMA, ATR, ADX, Ichimoku | Go |
| **L5** | Breadth, sector rotation, VIX adapter | Go |
| **L6** | Regime engine + pluggable strategy framework | Node.js |
| **L7** | Fastify API + WebSocket + Broker credential vault | Node.js |
| **L8** | Dashboard cockpit (/scalp) + Telegram + Email | Next.js |
| **L9** | ML inference + backtest engine | Python |
| **L10** | Order execution: paper→shadow→live, SL-M, fill confirm | Node.js |

---

## Current State

| Area | Status |
|------|--------|
| **Broker Auth** | ✅ MStock (TOTP), FlatTrade, Kite, IndianAPI |
| **Provider Registry** | ✅ Add/edit/enable/disable from dashboard |
| **Dashboard Cockpit** | ✅ `/scalp` — SafetyBar, PriceChart, OptionChainGrid, StrikePreview, Confluence |
| **Execution Safety** | ✅ 8/8 invariants, SL-M atomic, broker fill confirm, ordertags |
| **Synthetic Data Labeling** | ✅ Rule 13 — OptionSimulator + PaperExecutor tagged `synthetic: true` |
| **Engineering Standards** | ✅ 82% compliance (up from 35%) |
| **Testing** | ✅ 31 tests across L2, L4, L5, L6, L10, L7 |
| **Kafka Hardening** | ✅ Manual commits, producer config, versioned groups |
| **Docker** | ✅ Multi-stage, tini, HEALTHCHECKs, log rotation |
| **CI Pipeline** | ✅ GitHub Actions (test-node + test-go + lint) |
| **Research Plane** | 🔲 PLAN — k-NN analog matching, 4 phases |
| **NOT live** | 🚫 `LIVE_TRADING_ARMED` unset |

---

## Commands

| Command | Does |
|---------|------|
| `make setup` | Install ALL deps (Node.js + Go + Python) |
| `make up` | Purge Docker cache → build → start core pipeline |
| `make up-all` | Everything (+ observer, notify, AI, execution) |
| `make build` | Verify all layers have deps |
| `make test-all` | Run all 31 tests |
| `make layer1`..`make layer8` | Run individual layer |
| `make db-migrate` | Apply broker tables migration |
| `make logs` | Tail Docker logs |

---

## Single Source of Truth — `shared/`

```js
// One import, all cross-layer constants:
const { KAFKA_TOPICS, PORTS, REDIS_KEYS } = require('/app/shared');
```

| File | Content |
|------|---------|
| `constants.js` | Runtime: REGIME, SIGNAL, KAFKA_TOPICS (11), PORTS (19), BROKER_URLS, REDIS_KEYS |
| `constants.ts` | Type-safe mirror for IDE/tsc |
| `constants.go` | Go mirror — L4/L5 import |
| `types.ts` | 25 interfaces: TradeSignal, Position, RegimeState, Loaded\<T\> |
| `ports.ts` | 9 interfaces: ExecutionPort, MarketPort, OptionsPort |
| `index.js` | CommonJS barrel: `require('/app/shared')` |
| `index.ts` | TypeScript barrel |

---

## 📚 Documentation Hub

### Canonical (Read First)

| Doc | Content |
|-----|---------|
| [`docs/VISION.md`](docs/VISION.md) | **Vision** — what, why, 3 planes, safety invariants, roadmap |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | **Architecture** — 3 planes, layers, extensibility, security |

### Tracking & Audits

| Doc | Content |
|-----|---------|
| [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) | Master completion tracker — all phases, session log |
| [`docs/ENGINEERING_STANDARDS_AUDIT.md`](docs/ENGINEERING_STANDARDS_AUDIT.md) | 12-section compliance audit (82%) |
| [`docs/RESTRUCTURE_PLAN.md`](docs/RESTRUCTURE_PLAN.md) | 67-finding production audit + 6-week remediation |

### Trading & Strategy

| Doc | Content |
|-----|---------|
| [`docs/TARGET_ARCHITECTURE.md`](docs/TARGET_ARCHITECTURE.md) | North star — Control vs Data Plane, provider-agnostic adapters |
| [`docs/MOMENTUM_TRADING_ARCHITECTURE.md`](docs/MOMENTUM_TRADING_ARCHITECTURE.md) | Strategy + adaptive framework, timeframe tiers |
| [`docs/OPTIONS_SCALPING_RULES.md`](docs/OPTIONS_SCALPING_RULES.md) | Execution invariants, scalping rules |
| [`docs/SIMPLE_ROBUST_ARCHITECTURE_PLAN.md`](docs/SIMPLE_ROBUST_ARCHITECTURE_PLAN.md) | Provider registry, credential vault, session service |

### Dashboard & Frontend

| Doc | Content |
|-----|---------|
| [`docs/DASHBOARD_ENHANCEMENT_PLAN.md`](docs/DASHBOARD_ENHANCEMENT_PLAN.md) | Atomic design + scalp cockpit (ALL PHASES COMPLETE) |
| [`docs/DASHBOARD_PLAN.md`](docs/DASHBOARD_PLAN.md) | Original dashboard architecture plan |

### Research & Future

| Doc | Content |
|-----|---------|
| [`docs/RESEARCH_PLANE_PLAN.md`](docs/RESEARCH_PLANE_PLAN.md) | k-NN analog matching engine (PLAN) |
| [`docs/TYPESCRIPT_MIGRATION_PLAN.md`](docs/TYPESCRIPT_MIGRATION_PLAN.md) | TS migration — 72 files typed, pattern docs |

### Infrastructure

| Doc | Content |
|-----|---------|
| [`docs/BROKER_LOGIN_FLOWS.md`](docs/BROKER_LOGIN_FLOWS.md) | MStock, FlatTrade, Kite, IndianAPI auth flows |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) | TimescaleDB hypertables, continuous aggregates |
| [`docs/Dockerfile.hardened.template`](docs/Dockerfile.hardened.template) | Reference Dockerfile for new services |
| [`.ai/skills/`](.ai/skills/) | AI coding skills (graphify, kafka, db, docker, engineering) |

---

## 🧠 AI Agent System

This project uses an agentic AI workflow with 12 specialist agents across 6 skills. All AI tools (Claude Code, OpenCode, DeepSeek, Copilot) read the same contract.

| File | Content |
|------|---------|
| [`CLAUDE.md`](CLAUDE.md) | Primary AI instructions |
| [`AGENTS.md`](AGENTS.md) | Universal entry point for all AI tools |
| [`.ai/CONTRACT.md`](.ai/CONTRACT.md) | Universal AI contract — non-negotiable rules |
| [`.ai/agents/`](.ai/agents/) | 12 specialist agent definitions |
| [`.ai/skills/`](.ai/skills/) | 6 shared skills |
| [`.claude/settings.json`](.claude/settings.json) | Auto-mode + PreToolUse hooks |

---

## 🏗️ Project Structure

```
Trading-System/
├── README.md              ← Master documentation hub
├── ARCHITECTURE.md        ← Canonical architecture
├── Makefile               ← All commands (make help)
├── shared/                ← [Single source of truth](shared/README.md) (constants, types, ports)
├── docs/                  ← All documentation
├── .ai/                   ← AI agent workflow (12 agents, 6 skills)
│
├── [layer-1-ingestion/](layer-1-ingestion/README.md)     ← L1: Broker data gateway (Node.js)
├── [layer-2-processing/](layer-2-processing/README.md)   ← L2: Tick → candles (Node.js)
├── layer-3-storage/                                     ← L3: TimescaleDB + Redis schemas
├── [layer-4-analysis/](layer-4-analysis/README.md)       ← L4: Indicators (Go)
├── [layer-5-aggregation/](layer-5-aggregation/README.md) ← L5: Market breadth (Go)
├── [layer-6-signal/](layer-6-signal/README.md)           ← L6: Regime + strategies (Node.js)
├── [layer-7-core-interface/api/](layer-7-core-interface/api/README.md) ← L7: REST API (Node.js/Fastify)
├── [layer-8-presentation/stock-analysis-portal/](layer-8-presentation-notification/stock-analysis-portal/README.md) ← L8: Dashboard (Next.js)
├── layer-9-ai-service/                                  ← L9: ML inference (Python)
├── [layer-10-execution/](layer-10-execution/README.md)   ← L10: Order execution (Node.js)
└── infrastructure/                                      ← Docker, Kafka, monitoring
