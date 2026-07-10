# Architecture Docs Index

## Core Architecture

| Doc | Status | Last Updated |
|-----|--------|-------------|
| [`TARGET_ARCHITECTURE.md`](TARGET_ARCHITECTURE.md) | North star — Control Plane vs Data Plane, provider-agnostic adapters | 2026-07-09 |
| [`SIMPLE_ROBUST_ARCHITECTURE_PLAN.md`](SIMPLE_ROBUST_ARCHITECTURE_PLAN.md) | Provider registry, credential vault, broker session, Docker hardening | 2026-07-10 |
| [`MOMENTUM_TRADING_ARCHITECTURE.md`](MOMENTUM_TRADING_ARCHITECTURE.md) | Strategy + adaptive framework, timeframe tiers | 2026-07-09 |
| [`OPTIONS_SCALPING_RULES.md`](OPTIONS_SCALPING_RULES.md) | Execution invariants, scalping rules | 2026-07-09 |

## Plans & Audits

| Doc | Status |
|-----|--------|
| [`RESTRUCTURE_PLAN.md`](RESTRUCTURE_PLAN.md) | 67-finding production audit, 6-week remediation plan |
| [`DASHBOARD_ENHANCEMENT_PLAN.md`](DASHBOARD_ENHANCEMENT_PLAN.md) | Atomic design, scalp cockpit, ports/adapter, 6 phases (ALL COMPLETE) |
| [`ENGINEERING_STANDARDS_AUDIT.md`](ENGINEERING_STANDARDS_AUDIT.md) | 12-section rule-by-rule compliance (82%) |
| [`TYPESCRIPT_MIGRATION_PLAN.md`](TYPESCRIPT_MIGRATION_PLAN.md) | 6-phase TS migration plan (53/194 done, 27%) |
| [`BROKER_LOGIN_FLOWS.md`](BROKER_LOGIN_FLOWS.md) | Per-broker auth flows: MStock, FlatTrade, Kite, IndianAPI |

## Operational

| Doc | Status |
|-----|--------|
| [`PROJECT_STATE.md`](PROJECT_STATE.md) | Master completion tracker — single source of truth |
| [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) | TimescaleDB hypertables, continuous aggregates |
| [`ARCHITECTURE_DEEP_DIVE.md`](ARCHITECTURE_DEEP_DIVE.md) | Layer breakdown, data volume analysis |
| [`Dockerfile.hardened.template`](Dockerfile.hardened.template) | Reference Dockerfile for new services |

## Shared (cross-layer source of truth)

| File | Content |
|------|---------|
| `../shared/types.ts` | 25 interfaces (RegimeState, TradeSignal, Position, Loaded<T>, branded types) |
| `../shared/ports.ts` | 9 interfaces (ExecutionPort, MarketPort, OptionsPort, etc.) |
| `../shared/constants.js` | REGIME, SIGNAL, KAFKA_TOPICS (11), KAFKA_GROUPS (7), PORTS (19), BROKER_URLS |
| `../shared/constants.go` | Go mirror — Provider names, Kafka topics, Ports |
| `../shared/index.ts` | Barrel export |
