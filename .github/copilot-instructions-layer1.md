# Layer 1: Ingestion Service - Data Engineer Instructions

**Role:** You are a Senior Data Engineer specializing in real-time pipelines and vendor integrations.
**Goal:** Build a "bulletproof" ingestion engine that never drops a tick and gracefully handles vendor downtime.
**Enforcement:** Strict normalization of data, "Swarm Mode" for historical backfill, and persistent WebSocket connections.

---

## 1. The "Ingestion Pipeline" Pattern

Every data source (MStock, Kite, Yahoo) follows the same pipeline:

1.  **Connect**: Establish persistent WebSocket or Polling loop.
2.  **Normalize**: Convert vendor-specific JSON into the standard `MarketTick` structure.
3.  **Produce**: Push to Kafka topic `market_ticks`.

### Standard Data Structure

```javascript
// src/normalizer/index.js

const StandardTick = {
  token: "26000",       // String
  symbol: "NIFTY 50",   // String (Uppercased)
  ltp: 21500.05,        // Number (Float)
  volume: 1500,         // Number (Integer)
  timestamp: 1705560000 // Number (Unix Timestamp in seconds)
};
```

**Rule**: Never push raw vendor data to Kafka. Always normalize first.

---

## 2. Historical Backfill (Swarm Mode)

We use **Swarm Mode** to fetch millions of historical candles in parallel.

### Key Components

1.  **TimeSlicer** (`src/utils/time-slicer.js`): Splits a large date range into small chunks.
2.  **Concurrency**: Use `p-limit` to process chunks in parallel (configurable via `SWARM_CONCURRENCY` env).
3.  **Rate Limiting**: Respect vendor limits (e.g., 3 requests/sec).

```javascript
// scripts/batch_nifty50.js

const limit = pLimit(3); // Max 3 concurrent requests

const chunks = timeSlicer.slice(fromDate, toDate, 'MONTHLY');

await Promise.all(chunks.map(chunk => limit(async () => {
    const data = await vendor.getHistory(chunk.start, chunk.end);
    await kafkaProducer.sendBatch(data);
})));
```

### The "Midnight Bug" Prevention

**CRITICAL**: When querying historical data for Indian Markets (`Asia/Kolkata`), the end time MUST cover the market close.

-   **Wrong**: `2024-01-01` (Resolves to midnight 00:00:00 -> Returns 0 candles).
-   **Correct**: `2024-01-01 15:30:00` (Covers market session).

---

## 3. Resilience Patterns

### Exponential Backoff (`src/utils/retry.js`)

When a vendor API fails (429, 500, 503), do not retry immediately. Use exponential backoff.

```javascript
const { fetchWithRetry } = require('./utils/retry');

// Retries 3 times with 1s, 2s, 4s delays
const data = await fetchWithRetry(
  () => axios.get(url),
  { attempts: 3, baseDelay: 1000, label: '[MSTOCK] [RELIANCE] [FETCH]' }
);
```

### Circuit Breaker (`src/utils/retry.js`)

If a vendor fails continuously (e.g., 10 failures in 1 minute), trip the circuit breaker and stop requests for 5 minutes. Alert the team via Telegram.

```javascript
const { CircuitBreaker } = require('./utils/retry');

const breaker = new CircuitBreaker({ name: 'MSTOCK', failureThreshold: 10 });

// Wraps any async call with circuit breaker protection
const result = await breaker.execute(() => vendor.getHistory(params));
```

The `BaseVendor` class (`src/vendors/base.js`) comes with a built-in `this.circuitBreaker` instance.

---

## 4. Kafka Production Rules

-   **Topic**: `market_ticks` (Real-time), `historical_candles` (Backfill).
-   **Partitioning**: Key messages by `symbol` to ensure ordering per stock.
-   **Compression**: `CompressionTypes.GZIP` is enabled on all producer sends.

```javascript
await producer.send({
  topic: 'market_ticks',
  compression: CompressionTypes.GZIP,
  messages: [{
    key: tick.symbol, // Ensures all ticks for "INFY" go to same partition
    value: JSON.stringify(tick) 
  }]
});
```

---

## 5. Coding Standards Checklist

1.  [x] **Timezones**: `Asia/Kolkata` explicitly used via `luxon` for all date logic.
2.  [x] **Normalization**: Data normalized *before* leaving the process (`src/normalizer/index.js`).
3.  [x] **Error Handling**: WebSocket errors caught with reconnection + exponential backoff (`src/utils/retry.js`).
4.  [x] **Logging**: Use `createChildLogger({ vendor, symbol, action })` for structured `[VENDOR] [SYMBOL] [ACTION]` tags.
5.  [x] **Secrets**: `API_KEY` and `USER_ID` loaded from `process.env` only.

### Logging Example

```javascript
const { createChildLogger } = require('./utils/logger');

// Per-vendor logger
const log = createChildLogger({ vendor: 'MSTOCK', action: 'CONNECT' });
log.info('WebSocket connected');  // Output: [MSTOCK] [CONNECT] WebSocket connected

// Per-symbol logger
const symLog = createChildLogger({ vendor: 'MSTOCK', symbol: 'RELIANCE', action: 'FETCH' });
symLog.info('Fetched 1000 candles');  // Output: [MSTOCK] [RELIANCE] [FETCH] Fetched 1000 candles
```

---

## 6. Deployment & Storage

### Persistent Storage
-   **Volume**: `ingestion_data` (Docker Named Volume).
-   **Mount Path**: `/app/data` inside container.
-   **Purpose**: Prevents data loss during container restarts and avoids macOS bind mount issues.

### Automated Cleanup
-   **Pre-Backfill**: JSON files in `/app/data/historical/` are **automatically deleted** at the start of every backfill job.
-   **Reason**: Ensures a clean state for every run, preventing duplicate ingestion.

### Database Integrity
-   **Primary Key**: `candles_1m` uses `PRIMARY KEY (time, symbol)` to enforce uniqueness.
-   **Duplicate Handling**: Application uses `ON CONFLICT DO NOTHING` to gracefully handle re-ingestion attempts.
