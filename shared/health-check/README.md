# @trading-system/health-check

Shared health check utilities for Trading System services. Single source of truth for all infrastructure dependency checks.

## Installation

This package is used as a local dependency. In your service's `package.json`:

```json
{
  "dependencies": {
    "@trading-system/health-check": "file:../../shared/health-check"
  }
}
```

Or mount it as a volume in Docker and require it directly.

## Usage

### Wait for All Dependencies

```javascript
const { waitForAll } = require('@trading-system/health-check');

async function main() {
  // Wait for all infrastructure before starting
  const { redis, timescale } = await waitForAll({
    kafka: {
      brokers: ['kafka:29092'],
      topic: 'raw-ticks',  // Optional: verify topic has leaders
    },
    redis: {
      url: 'redis://redis:6379',
    },
    timescale: {
      connectionString: 'postgresql://user:pass@timescaledb:5432/db',
      requiredTables: ['candles_1m'],  // Optional: verify tables exist
    },
  });

  // Use the returned clients
  await redis.set('key', 'value');
  const result = await timescale.query('SELECT 1');
}
```

### Wait for Individual Services

```javascript
const { waitForKafka, waitForRedis, waitForTimescale } = require('@trading-system/health-check');

// Kafka only
await waitForKafka({
  brokers: ['kafka:29092'],
  topic: 'raw-ticks',
  maxRetries: 30,
  delayMs: 2000,
});

// Redis only (returns connected client)
const redisClient = await waitForRedis({
  url: 'redis://redis:6379',
});

// TimescaleDB only (returns pg Pool)
const pgPool = await waitForTimescale({
  connectionString: 'postgresql://...',
  requiredTables: ['candles_1m', 'data_availability'],
});
```

### Health Check Endpoint

```javascript
const { checkAllHealth } = require('@trading-system/health-check');

app.get('/health', async (req, res) => {
  const health = await checkAllHealth({
    kafka: { brokers: ['kafka:29092'] },
    redis: { url: 'redis://redis:6379' },
    timescale: { connectionString: '...' },
  });

  res.status(health.healthy ? 200 : 503).json(health);
});
```

Response:
```json
{
  "healthy": true,
  "services": {
    "kafka": { "healthy": true, "message": "Kafka is healthy" },
    "redis": { "healthy": true, "message": "Redis is healthy" },
    "timescale": { "healthy": true, "message": "TimescaleDB is healthy" }
  }
}
```

## Configuration

### Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `maxRetries` | 20 | Maximum retry attempts |
| `delayMs` | 3000 | Delay between retries (ms) |
| `connectionTimeout` | 10000 | Connection timeout (ms) |

### Custom Logger

```javascript
const { waitForAll } = require('@trading-system/health-check');
const pino = require('pino');
const logger = pino();

await waitForAll(dependencies, { logger });
```

## API Reference

### `waitForAll(dependencies, options)`

Wait for all specified dependencies.

**Parameters:**
- `dependencies.kafka` - Kafka config `{ brokers, topic }`
- `dependencies.redis` - Redis config `{ url }`
- `dependencies.timescale` - TimescaleDB config `{ connectionString, requiredTables }`
- `options.logger` - Custom logger (default: console)
- `options.parallel` - Wait in parallel (default: false)

**Returns:** `{ redis, timescale }` - Connected clients

### `waitForKafka(options)`

Wait for Kafka broker and optionally verify topic.

**Parameters:**
- `options.brokers` - Array of broker addresses (required)
- `options.topic` - Topic to verify (optional)
- `options.maxRetries` - Max retry attempts
- `options.delayMs` - Delay between retries

### `waitForRedis(options)`

Wait for Redis and return connected client.

**Parameters:**
- `options.url` - Redis URL (required)
- `options.maxRetries` - Max retry attempts
- `options.delayMs` - Delay between retries

**Returns:** Connected Redis client

### `waitForTimescale(options)`

Wait for TimescaleDB and optionally verify tables.

**Parameters:**
- `options.connectionString` - PostgreSQL URL (required)
- `options.requiredTables` - Tables to verify (optional)
- `options.maxRetries` - Max retry attempts
- `options.delayMs` - Delay between retries

**Returns:** pg Pool instance

## Prometheus Metrics (Grafana)

The library includes Prometheus metrics for monitoring infrastructure health in Grafana.

### Enable Metrics

```javascript
const { waitForAll, initHealthMetrics } = require('@trading-system/health-check');
const { register } = require('prom-client');

// Initialize health metrics with your Prometheus registry
initHealthMetrics(register);

// Or pass registry to waitForAll
await waitForAll(dependencies, {
  logger,
  metricsRegistry: register
});
```

### Available Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `infrastructure_all_services_healthy` | Gauge | Overall health (1=healthy, 0=unhealthy) |
| `infrastructure_kafka_healthy` | Gauge | Kafka health status |
| `infrastructure_redis_healthy` | Gauge | Redis health status |
| `infrastructure_timescale_healthy` | Gauge | TimescaleDB health status |
| `infrastructure_kafka_connect_seconds` | Histogram | Kafka connection latency |
| `infrastructure_redis_connect_seconds` | Histogram | Redis connection latency |
| `infrastructure_timescale_connect_seconds` | Histogram | TimescaleDB connection latency |
| `infrastructure_kafka_retries_total` | Counter | Kafka retry attempts |
| `infrastructure_redis_retries_total` | Counter | Redis retry attempts |
| `infrastructure_timescale_retries_total` | Counter | TimescaleDB retry attempts |
| `infrastructure_kafka_partitions` | Gauge | Kafka topic partition count |
| `infrastructure_kafka_partitions_with_leaders` | Gauge | Partitions with active leaders |
| `infrastructure_startup_seconds` | Histogram | Service startup duration |

### Grafana Dashboard

Import the pre-built dashboard from:
```
infrastructure/monitoring/grafana/dashboards/infrastructure-health.json
```

## Docker Usage

Mount the shared library in your Dockerfile or docker-compose:

```yaml
volumes:
  - ../../shared:/app/shared:ro
```

Then in your code:
```javascript
const { waitForAll } = require('/app/shared/health-check');
```
