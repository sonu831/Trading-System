# Layer 1 — Ingestion (Data Gateway)

> **One job:** Pull market data from all enabled broker sources and produce normalized ticks to Kafka.
> **Tech:** Node.js 20 · **Port:** 9101 · **Brokers:** MStock, FlatTrade, Kite, IndianAPI, Composite

## Architecture

```
Broker WS/REST → Vendor Adapter → Normalizer → Kafka (raw-ticks)
                    │                              │
                    └── OptionChainPoller ──────────┘ (option-chain)
```

## Files

| Dir | Purpose |
|-----|---------|
| `src/vendors/` | Broker adapters: MStock, FlatTrade, Kite, IndianAPI, Composite, OptionChainPoller |
| `src/vendors/CredentialStore.js` | Reads enabled providers from L7 API, caches tokens from Redis |
| `src/vendors/factory.js` | `VendorFactory.createVendor()` — one switch, add a case for new broker |
| `src/vendors/manager.js` | `VendorManager` ("The Octopus") — orchestrates multiple vendors |
| `src/mappers/` | Per-vendor tick → normalized `InternalTick` mapping |
| `src/kafka/producer.js` | Kafka producer: `maxInFlightRequests: 1`, symbol-based partitioning |
| `src/utils/` | HTTP client (connection pooling), logger, IST helpers, market hours |

## Adding a New Broker

1. Create `src/vendors/<broker>.js` extending `BaseVendor`
2. Create `src/mappers/<broker>.js` with `map(rawData) → InternalTick`
3. Add `case '<broker>'` in `factory.js`
4. Register in `broker_providers` table via API
5. Add credentials via dashboard at `/brokers`

## Key Constants (from `shared/`)

```js
const { BROKER_BASE_URLS, REDIS_KEYS, KAFKA_TOPICS } = require('/app/shared');
```

## Run

```bash
make layer1          # Local dev
make docker-ingestion  # Docker
```
