# Layer 7 — Core Interface (API + WebSocket)

> **One job:** Expose market data, signals, and broker management via REST + WebSocket. The single entry point for all clients.
> **Tech:** Node.js 20 · Fastify · PM2 · **Port:** 4000

## Architecture

```
Kafka + Redis → Fastify Routes → JSON Response
                  │
                  ├── REST: /api/v1/market, /api/v1/options, /api/v1/signals
                  ├── WebSocket: Socket.io → Redis Pub/Sub → real-time push
                  ├── Broker Vault: /api/v1/providers (encrypted credentials)
                  └── Execution Proxy: /api/v1/execution (kill, resume, square-off)
```

## Key Modules

| Module | Purpose |
|--------|---------|
| `src/modules/broker/` | Provider registry + credential vault + session service |
| `src/modules/broker/strategies/` | Per-broker auth: MStock (TOTP), FlatTrade (request_code), Kite (request_token), IndianAPI (none) |
| `src/modules/system/` | Health, backfill, session clock, options, VIX |
| `src/modules/execution/` | Proxy to L10 execution engine |
| `src/modules/market/` | Market data queries |
| `src/modules/signals/` | Signal feed |
| `src/common/` | BaseController, BaseRepository, BaseService |
| `src/plugins/websocket.js` | Redis→Socket.io bridge for real-time push |

## API Pattern

```js
// Adding a new endpoint:
// 1. Create module: routes.js, Controller.js, Service.js, Repository.js
// 2. Register in container.js (DI) + index.js (route)
// 3. Schema in schemas.js — Fastify validates + serializes
```

## Key Constants

```js
const { PORTS, REDIS_KEYS, KAFKA_TOPICS } = require('/app/shared');
```

## Run

```bash
make layer7          # Local dev (Fastify on :4000)
make docker-api      # Docker
```
