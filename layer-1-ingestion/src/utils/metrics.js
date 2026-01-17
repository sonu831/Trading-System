/**
 * Prometheus Metrics
 */

const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
const ticksCounter = new client.Counter({
  name: 'ingestion_ticks_total',
  help: 'Total ticks received',
  labelNames: ['symbol'],
  registers: [register]
});

const ticksPerSecond = new client.Counter({
  name: 'ingestion_ticks_per_second',
  help: 'Ticks received per second',
  registers: [register]
});

const invalidTicksCounter = new client.Counter({
  name: 'ingestion_invalid_ticks_total',
  help: 'Total invalid ticks',
  registers: [register]
});

const websocketConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections',
  registers: [register]
});

const reconnectionAttempts = new client.Counter({
  name: 'websocket_reconnections_total',
  help: 'WebSocket reconnection attempts',
  registers: [register]
});

const kafkaMessagesSent = new client.Counter({
  name: 'kafka_messages_sent_total',
  help: 'Messages sent to Kafka',
  labelNames: ['topic'],
  registers: [register]
});

const errorCounter = new client.Counter({
  name: 'ingestion_errors_total',
  help: 'Total errors',
  labelNames: ['type'],
  registers: [register]
});

const metrics = {
  ticksCounter,
  ticksPerSecond,
  invalidTicksCounter,
  websocketConnections,
  reconnectionAttempts,
  kafkaMessagesSent,
  errorCounter
};

module.exports = { metrics, register };
