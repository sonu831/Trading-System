# Cockpit Backend Integration Audit — 2026-07-11

> **Phase 1 status:** 85% backend-ready. **Phase 2 (this session):** wire frontend adapters, socket rooms, and missing pages.
> **Generated from:** real route inventory (64 endpoints verified), real frontend code (api/index.ts, cockpitSlice, useSocket).
> **Read with:** `docs/COCKPIT_BACKEND_PLAN.md`, `docs/design/FULL_COCKPIT_DESIGN_PROMPT.md`.

---

## 0. Screen → Endpoint Mapping (17 Tabs + 4 Detail Routes)

Legend: ✅ **Wired** (frontend calls it) · 🟡 **Backend ready, needs adapter** · 🔴 **Missing** · ⏸️ **Gated**

### GROUP 1 · TRADE

| # | Screen | Endpoint(s) | Frontend Status |
|---|--------|------------|----------------|
| 1 | **Scalp Cockpit** `/scalp/[underlying]` | `GET /market/index/:u/quote`, `/candles`, `/options/chain`, `/options/expiries`, `/options/analytics`, `/execution/strike-preview`, `/regime/latest`, `/breadth/latest` | ✅ Fully wired in `cockpit.tsx` + `useMarket.ts` |
| 2 | **Positions & P&L** `/positions` | `GET /execution/state`, `POST /execution/square-off` | ✅ Wired via `ExecutionApi` + `executionSlice` |
| 3 | **Orders & Execution** `/orders` | `GET /execution/orders` | 🟡 Backend ready, NO frontend page/adapter yet |

### GROUP 2 · ANALYZE

| # | Screen | Endpoint(s) | Frontend Status |
|---|--------|------------|----------------|
| 4 | **Overview** `/` | `GET /market-view`, `/regime/latest`, `/signals` | 🟡 `useDashboard.tsx` calls market-view but no dedicated Overview page |
| 5 | **Market Internals** `/internals` | `GET /breadth/latest`, `/options/analytics` | 🟡 Backend ready, NO frontend page |
| 6 | **Regime** `/regime` | `GET /regime/latest` | 🟡 RegimeCard exists but NO standalone regime page |
| 7 | **Predictions / AI** `/ai` | `GET /api/v1/predict?underlying=&horizon=` (stub) | ⏸️ Gated — Phase-0 breadth study first |
| 8 | **Signals** `/signals` | `GET /signals` | 🟡 Backend ready, SignalCard exists but NO dedicated signals page |
| 9 | **Backtest Lab** `/backtest` | `POST /backtest` (proxy to L9) | 🟡 Backend ready, NO frontend page/adapter |

### GROUP 2 — Detail Route

| # | Route | Endpoint(s) | Frontend Status |
|---|-------|------------|----------------|
| — | **Symbol Analysis** `/analysis/[symbol]` | `GET /api/market/analysis/:symbol`, `/enhanced-multi-tf/:symbol`, `/ai-predict/:symbol` | ✅ Wired in `useStockAnalysis.ts` + analysis page |

### GROUP 3 · CONFIGURE

| # | Screen | Endpoint(s) | Frontend Status |
|---|--------|------------|----------------|
| 10 | **Strategies** `/strategies` | `GET /strategies`, `PATCH /strategies/:id` | 🟡 Backend ready, existing page partial |
| 11 | **Risk** `/risk` | `GET /risk/config`, `PATCH /risk/config` | 🟡 Backend ready, DailyRiskCard exists but NO config page |
| 12 | **Brokers** `/brokers` | All broker module routes (13 endpoints) | ✅ Fully wired in brokerSlice + BrokerDetail |
| 13 | **Settings** `/settings` | Client-side only (theme/display/notif prefs) | 🟡 NO page yet |

### GROUP 4 · OPERATE

| # | Screen | Endpoint(s) | Frontend Status |
|---|--------|------------|----------------|
| 14 | **Backfill** `/backfill` | `GET /backfill`, `POST /system/backfill/trigger` | ✅ Wired in BackfillPanel/Manager |
| 15 | **Swarm** `/swarm` | `GET /system/backfill/swarm/status` | ✅ Wired in SwarmMonitor |
| 16 | **System Health** `/system` | `GET /system-status`, `/health`, `/health/feeds`, `/health/detailed` | ✅ Wired in system.tsx (polls every 3s) |
| 17 | **Alerts** `/alerts` | `GET /alerts` (+ WS `alerts-stream`) | 🟡 Backend ready, NO frontend page/adapter |

---

## 1. Frontend Gaps (what to build now)

### 1a. Missing API Adapters (`src/api/index.ts`)

```ts
// ADD these three adapters:

export const OrdersApi = {
  list: () => get<Array<OrderRecord>>('/execution/orders'),
};

export const AlertsApi = {
  list: (severity?: string, limit = 50) => 
    get<{ alerts: AlertItem[]; count: number }>(`/alerts${severity ? `?severity=${severity}&` : '?'}limit=${limit}`),
};

export const BacktestApi = {
  run: (params: Record<string, unknown>) =>
    fetch(`${API}/backtest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) }).then(r => r.json()),
};
```

### 1b. Socket.io Rooms to Wire

Add these handlers to `useSocket.ts`:

```ts
socket.on('execution', (data) => dispatch(cockpitExecutionPushed(data)));
socket.on('alert', (data) => dispatch(cockpitAlertPushed(data)));
socket.on('breadth', (data) => dispatch(cockpitBreadthPushed(data)));
```

And add corresponding actions to `cockpitSlice.ts`:
- `cockpitExecutionPushed` — updates positions/orders in realtime
- `cockpitAlertPushed` — appends to alerts feed
- `cockpitBreadthPushed` — updates market internals

### 1c. New Pages Needed (10 screens)

| Page | Route | Data Source |
|------|-------|------------|
| Orders | `/orders` | `OrdersApi.list()` + WS `exec-stream` |
| Overview | `/` | `GET /market-view` + `GET /regime/latest` |
| Market Internals | `/internals` | `BreadthApi.getLatest()` |
| Regime | `/regime` | `GET /regime/latest` + WS `regime-stream` |
| Signals | `/signals` | `GET /signals` + WS `signals-stream` |
| Backtest | `/backtest` | `BacktestApi.run()` |
| Strategies | `/strategies` | `StrategiesApi.list()` + `PATCH` |
| Risk Config | `/risk` | `RiskApi.getConfig()` + `PATCH` |
| Settings | `/settings` | Client state (theme/display/notif) |
| Alerts | `/alerts` | `AlertsApi.list()` + WS `alerts-stream` |

---

## 2. What Already Works (7 screens, 0 work needed)

| Screen | Status |
|--------|--------|
| Scalp Cockpit | ✅ Fully wired — candles, chain, strike preview, confluence, SafetyBar |
| Positions & P&L | ✅ ExecutionApi + executionSlice + PositionsTable |
| Brokers | ✅ brokerSlice + BrokerDetail + CredentialForm |
| Backfill | ✅ BackfillPanel/Manager polling L7 |
| Swarm | ✅ SwarmMonitor polling |
| System Health | ✅ system.tsx polling every 3s |
| Symbol Analysis | ✅ useStockAnalysis + multi-TF endpoints |

---

## 3. Build Order

1. **API adapters** — OrdersApi, AlertsApi, BacktestApi → `src/api/index.ts`
2. **Socket.io** — 4 new room handlers → `useSocket.ts` + `cockpitSlice.ts`
3. **State slices** — ordersSlice, alertsSlice, backtestSlice → Redux store
4. **Hooks** — useOrders, useAlerts, useBacktest, useBreadth → `src/hooks/`
5. **Pages** — `/orders`, `/internals`, `/regime`, `/signals`, `/backtest`, `/risk`, `/alerts` → `src/pages/`
6. **Components** — OrderRow, AlertItem, SignalCard, BreadthMeter, SectorRotationStrip → `src/components/`
7. **Navigation** — 17-tab sidebar + bottom-bar → `CockpitTemplate`
8. **Docs** — update README, ARCHITECTURE.md with cockpit mapping
