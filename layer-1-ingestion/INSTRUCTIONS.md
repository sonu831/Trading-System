# Layer 1: Data Ingestion Instructions

## Overview

This layer is responsible for establishing stable, low-latency WebSocket connections to market data providers (e.g., NSE, Zerodha, Upstox) and pushing raw ticks into Apache Kafka.

## Development Guidelines

### Node.js Standards

- **ES Version**: Use ES2022+ features (Async/Await, optional chaining `?.`, nullish coalescing `??`).
- **Module System**: Use CommonJS (`require`) or ES Modules (`import`) consistently.
- **Linting**: Follow the standard configuration defined in `.eslintrc.json`.

### Code Formatting

- **Logging**: Use a structured logger (e.g., `pino` or `winston`).
  - Log levels: `debug` (ticks), `info` (connection status), `error` (disconnections).
  - Do NOT log sensitive tokens or keys.

```javascript
logger.info(
  {
    event: 'connection_established',
    provider: 'zerodha',
    timestamp: new Date().toISOString(),
  },
  'WebSocket connected'
);
```

- **Error Handling**:
  - Wrap async calls in `try/catch`.
  - Use custom error classes for connection failures vs. data parsing errors.
  - Implement exponential backoff for reconnection logic.

### Concurrency & Performance

- **WebSocket**: Use the `ws` library for maximum performance.
- **Buffers**: Avoid unnecessary object creation. Use Node.js `Buffer` for binary data handling if applicable.
- **Keep-Alive**: Implement application-level heartbeats even if the protocol supports ping/pong.

## Project Structure

```text
layer-1-ingestion/
├── src/
│   ├── producers/       # Kafka producer logic
│   ├── connectors/      # WebSocket client implementations
│   ├── parsers/         # Data normalization logic
│   ├── config/          # Configuration management
│   ├── utils/           # Helper functions
│   └── index.js         # Entry point
├── tests/               # Unit and Integration tests
├── package.json
└── Dockerfile
```

## Naming Conventions

- **Files**: `kebab-case.js` (e.g., `zerodha-connector.js`).
- **Classes**: `PascalCase` (e.g., `WebSocketManager`).
- **Variables/Functions**: `camelCase`.
- **Constants**: `UPPER_SNAKE_CASE`.

## Dependencies

- `ws`: WebSocket client.
- `kafkajs`: Apache Kafka client.
- `dotenv`: Environment variable management.
- `pino`: Structured logging.

## Security Considerations

- **Secrets**: Never hardcode API keys or secret tokens. Use `process.env`.
- **Validation**: Validate incoming tick data structure before pushing to Kafka to prevent poisoning the stream.

## Testing Guidelines

- **Unit Tests**: Test parsers and connection logic with mocks.
- **Integration Tests**: Test Kafka producer connectivity (requires a running Kafka instance or mock).
- **Mocking**: Mock WebSocket server for testing reconnection logic.

```javascript
// Example test pattern
test('should reconnect on close', async () => {
  const manager = new WebSocketManager(mockConfig);
  await manager.connect();
  manager.simulateDisconnect();
  expect(manager.reconnectAttempt).toHaveBeenCalled();
});
```

## Monitoring & Historical Backfill

### Prometheus Metrics

- **Consolidated Registry**: Use the shared registry in `src/utils/metrics.js`.
- **Metric Definitions**:
  - `ingestion_ticks_total`: Total ticks received from vendors.
  - `websocket_packets_total`: Count of raw WebSocket messages.
  - `websocket_data_bytes_total`: Total bandwidth (bytes).
  - `external_api_calls_total`: HTTP requests stats (vendor, endpoint, status).
- **IPC Pattern**: When running child processes (e.g., for backfill), use `process.send({ type: 'metric', name: 'metricKey', labels: { ... }, value: 1 })` to update the parent's Prometheus registry.

### Historical Backfill Process

- **Functionality**: Backfills the missing OHLC data for the last 5 days when the market is closed.
- **Manual Trigger**:
  1. Use Redis CLI: `PUBLISH system:commands "START_BACKFILL"`
  2. Use Dashboard: Click the "Trigger Backfill" button in the header.
- **Concurrency**: The `isBackfilling` flag in `index.js` prevents multiple jobs from running simultaneously.
- **State Storage**: The live status is published to Redis key `system:layer1:backfill` for UI consumption.
