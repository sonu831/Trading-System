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
// src/normalization/tick-normalizer.js

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

1.  **TimeSlicer**: Splits a large date range (e.g., 1 Year) into small chunks (e.g., 30 Days).
2.  **Concurrency**: Use `p-limit` to process chunks in parallel.
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

### Exponential Backoff

When a vendor API fails (429, 500, 503), do not retry immediately. Use exponential backoff.

```javascript
// src/utils/retry.js

async function fetchWithRetry(url, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await axios.get(url);
    } catch (err) {
      if (i === attempts - 1) throw err;
      const waitTime = Math.pow(2, i) * 1000; // 1s, 2s, 4s...
      await sleep(waitTime);
    }
  }
}
```

### Circuit Breaker

If a vendor fails continuously (e.g., 10 failures in 1 minute), trip the circuit breaker and stop requests for 5 minutes. Alert the team via Slack/Telegram.

---

## 4. Kafka Production Rules

-   **Topic**: `market_ticks` (Real-time), `historical_candles` (Backfill).
-   **Partitioning**: Key messages by `token` or `symbol` to ensure ordering.
-   **Compression**: Use `gzip` for high-throughput topics.

```javascript
await producer.send({
  topic: 'market_ticks',
  messages: [{
    key: tick.token, // Ensures all ticks for "INFY" go to same partition
    value: JSON.stringify(tick) 
  }]
});
```

---

## 5. Coding Standards Checklist

1.  [ ] **Timezones**: Is `Asia/Kolkata` explicitly used for all date logic?
2.  [ ] **Normalization**: Is data normalized *before* leaving the process?
3.  [ ] **Error Handling**: Are WebSocket errors caught and do they trigger reconnection?
4.  [ ] **Logging**: Do logs include `[VENDOR]`, `[SYMBOL]`, and `[ACTION]` tags?
5.  [ ] **Secrets**: Are `API_KEY` and `USER_ID` loaded from `process.env`?

---
