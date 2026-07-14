# Project State — Trading System

> Last updated: 2026-07-11 | Branch: `nifty-trading-plan`

## Completed: P0.1 Broker Auth Tests — 104/104 passing

8 failing tests fixed (was 70/78):
- Injected fake MStock adapter into test harness (routes SDK calls through fake dispatch)
- Kite query param capture in dispatch (checksum was sent as axios params, not body)
- Background-refresh guard (`canAuthenticateUnattended()` check before `getOrRefreshToken()`)
- FlatTrade stored-jKey validation via UserDetails probe
- TTL arithmetic rewrite with 120s buffer + day-wrap logic
- Error enrichment (`serverTimeUtc` + `likelyCauses` in verifyTOTP catch block)

## Completed: P0.3 TypeScript Infrastructure

- `shared/tsconfig.base.json` — 9 backend layers extend it
- `layer-2-processing/src/ambient.d.ts` — Docker path module declarations
- `layer-7-core-interface/api/tsconfig.json` — `@shared/*` path alias

## Completed: Cockpit Dashboard — 18 page routes

All pages use `AppShell` layout (sticky SafetyBar + 220px sidebar + main content) with consistent dark-theme CSS design tokens.

| Page | Route | Data Source |
|------|-------|-------------|
| Overview | `/` | Redux marketSlice + breadth |
| Scalp Cockpit | `/scalp` | WebSocket + Redux + REST |
| Positions & P&L | `/trading` | Redux executionSlice |
| Options Analytics | `/options` | REST hooks (useExpiries, useOptionChain) |
| Market Internals | `/internals` | Redux breadth (AdvanceDeclineBar, SectorRotation, HeavyweightTable) |
| Regime | `/regime` | Redux regimeSlice (5s polling) |
| Predictions | `/predictions` | `GET /api/v1/predict` (L9 proxy, abstain when offline) |
| Signals | `/signals` | `GET /api/v1/signals` (5s polling) |
| Backtest Lab | `/backtest` | Form + `POST /api/v1/backtest` proxy |
| Strategies | `/strategies` | `GET/PATCH /api/v1/strategies` (Redis) |
| Risk | `/risk` | `GET/PATCH /api/v1/risk/config` (Redis) |
| Brokers | `/brokers` | Redux brokerSlice (CRUD + auth) |
| Broker Detail | `/brokers/[id]` | Redux brokerSlice |
| Alerts | `/alerts` | `GET /api/v1/alerts` (Redis `alerts:feed`) |
| Settings | `/settings` | ThemeProvider context |
| Backfill Manager | `/backfill` | `GET /api/v1/data/availability` + `POST ../trigger` |
| Swarm Monitor | `/swarm` | `GET /api/v1/system/backfill/swarm/status` |
| Operations Dashboard | `/operate` | `GET /api/v1/system-status` + `data/stats` + swarm status (5s polling) |
| System Visualizer | `/system` | `GET /api/v1/system-status` (3s polling) |
| Cockpit (unified) | `/cockpit` | Custom full-bleed chart+chain+positions+risk grid |

## Completed: 14 Reusable Organisms

`AdvanceDeclineBar`, `AlertFeed`, `ConfluenceChecklist`, `EngineIntentCard`, `FeatureContributions`, `HeavyweightTable`, `OptionChainGrid`, `PredictionGauge`, `PriceChart`, `SafetyBar`, `SectorRotation`, `SignalCard`, `StrikePreviewCard`

## Completed: Storybook 7.6.20

Installed and configured with 14 story files across atomic tiers (Button, Card, Badge, Input, Modal, Table, DataTable, StatTile, TradeModeBadge, RiskMeter, StaleBadge, ConfirmDialog, ConfluenceChecklist, RegimeCard). Run `pnpm run storybook`.

## Completed: Backend Endpoint Wiring

### New endpoints added:
- `GET /api/v1/predict` — proxy to L9 AI, returns abstain when unavailable
- Socket.io rooms: `execution` (Redis `execution-events`), `alerts` (Redis `notifications`), `breadth` (Redis `sentiment_scores`)

### SystemService hardened (no more lying):
- `getInfraStatus()` — probes Redis `ping()`, TimescaleDB `SELECT 1`, Kafka status
- Layer status derived from metrics, not hardcoded `'ONLINE'`
- Layer names include tech stack (e.g., `L4 · Analysis (Go)`)

### Existing endpoints (already working):
- All broker CRUD (`/api/v1/providers/**`)
- All execution endpoints (`/api/v1/execution/*`)
- Market view + breadth + regime + signals
- Options chain + analytics
- Backfill trigger + status + job tracking
- Risk config + strategies config (Redis-based)
- System status + health + alerts + backtest proxy
- WebSocket (tick, chain, regime, positions, execution, alerts, breadth)

## Completed: CSS Design System

Utility classes in `globals.css`: `.card`, `.kv`, `.stat`, `.badge-ok/err/warn/paper/accent/neutral`, `.banner`, `.btn-primary`, `.btn-kill`, `.tabular-nums`, `.mono`. All broker components rewritten from hardcoded `text-white`/`bg-gray-800` to design tokens.

## Backend Infrastructure Status

| Layer | Status | Notes |
|-------|--------|-------|
| L1 Ingestion | Needs Docker | MStock WebSocket + REST backfill |
| L2 Processing | Needs Docker | Kafka consumer → candle aggregation |
| L3 Storage | Needs Docker | TimescaleDB hypertables + Redis |
| L4 Analysis (Go) | Needs Docker | Indicator computation |
| L5 Aggregation (Go) | Needs Docker | Breadth/sector/market_view |
| L6 Signal | Needs Docker | Trade signal generation |
| L7 API Gateway | Running (Docker) | Fastify on port 4000 |
| L9 AI Service | Needs Docker | Predictions + backtest |
| L10 Execution | Needs Docker | Paper/Shadow/Live execution |

The MStock data flow depends on Docker being up with valid broker session tokens in Redis at `broker:session:mstock`.

## In Progress: DB-Backed Configuration Migration

See original plan in earlier state. Not yet started.
