# Layer 2: Stream Processing Instructions

## Overview
This layer consumes raw ticks from Kafka, normalizes the data, handles late-arriving events, and aggregates individual ticks into OHLCV (Open, High, Low, Close, Volume) candles for various timeframes (1m, 5m, 15m).

## Development Guidelines

### Node.js Standards
- **Stream Processing**: Prioritize memory efficiency. Avoid storing large history in memory; use Redis for state.
- **Event Loop**: Do not block the event loop with heavy synchronous calculations.

### Code Formatting
- **Logging**: Structured logging is critical for tracing a specific tick ID or symbol.
- **Metrics**: Expose Prometheus metrics for "ticks processed per second" and "consumer lag".

```javascript
logger.info({
  symbol: 'RELIANCE',
  price: 2450.50,
  latency_ms: 5
}, 'Tick processed');
```

### Struct Definitions (JSDoc)
Since this is JavaScript, use JSDoc to define data structures for better IDE support.

```javascript
/**
 * @typedef {Object} Candle
 * @property {string} symbol
 * @property {string} timeframe - '1m', '5m', '15m'
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 * @property {number} timestamp
 */
```

## Project Structure

```text
layer-2-processing/
├── src/
│   ├── consumers/       # Kafka consumer group logic
│   ├── processors/      # Candle aggregation logic
│   ├── state/           # Redis state management
│   └── index.js         # Entry point
├── tests/               # Unit tests
├── package.json
└── Dockerfile
```

## Kafka Consumer Patterns
- **Consumer Groups**: Use specific consumer group IDs defined in env (e.g., `processing-group-1`).
- **Commits**: Use manual committing or autocommit with care. Ensure a candle is saved/published before committing the offset.
- **Partitioning**: Ensure the producer is partitioning by `symbol` so that all ticks for "RELIANCE" arrive at the same consumer instance.

## Dependencies
- `kafkajs`: Kafka client.
- `redis`: Redis client for maintaining in-progress candle state.
- `pg`: PostGreSQL client (if direct writing to DB, though usually Layer 3 handles this).

## Testing Guidelines
- **Candle Logic**: Heavily test the O/H/L/C update logic.
  - Scenario: Tick price 100 -> Open=100, High=100, Low=100, Close=100.
  - Scenario: Tick price 105 -> High becomes 105.
  - Scenario: Tick price 95 -> Low becomes 95.
- **Timeframes**: Test boundary conditions (e.g., tick arriving at 09:15:59 vs 09:16:00).

```javascript
test('should update high/low correctly', () => {
  const candle = new CandleBuilder();
  candle.update(100);
  candle.update(105);
  candle.update(95);
  expect(candle.high).toBe(105);
  expect(candle.low).toBe(95);
});
```
