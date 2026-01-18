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
  registers: [register],
});

const ticksPerSecond = new client.Counter({
  name: 'ingestion_ticks_per_second',
  help: 'Ticks received per second',
  registers: [register],
});

const invalidTicksCounter = new client.Counter({
  name: 'ingestion_invalid_ticks_total',
  help: 'Total invalid ticks',
  registers: [register],
});

const websocketConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections',
  registers: [register],
});

const websocketPackets = new client.Counter({
  name: 'websocket_packets_total',
  help: 'Total WebSocket packets received',
  labelNames: ['vendor'],
  registers: [register],
});

const websocketDataBytes = new client.Counter({
  name: 'websocket_data_bytes_total',
  help: 'Total WebSocket data received in bytes',
  labelNames: ['vendor'],
  registers: [register],
});

const reconnectionAttempts = new client.Counter({
  name: 'websocket_reconnections_total',
  help: 'WebSocket reconnection attempts',
  registers: [register],
});

const kafkaMessagesSent = new client.Counter({
  name: 'kafka_messages_sent_total',
  help: 'Messages sent to Kafka',
  labelNames: ['topic'],
  registers: [register],
});

const errorCounter = new client.Counter({
  name: 'ingestion_errors_total',
  help: 'Total errors',
  labelNames: ['type'],
  registers: [register],
});

// External API Call Tracking
const externalApiCalls = new client.Counter({
  name: 'external_api_calls_total',
  help: 'Total external API calls',
  labelNames: ['vendor', 'endpoint', 'status'],
  registers: [register],
});

const externalApiLatency = new client.Histogram({
  name: 'external_api_latency_seconds',
  help: 'External API call latency in seconds',
  labelNames: ['vendor', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Batch Job Metrics
const batchJobStatus = new client.Gauge({
  name: 'batch_job_status',
  help: 'Batch job status (0=idle, 1=running, 2=completed, 3=failed)',
  labelNames: ['job_type'],
  registers: [register],
});

const batchJobProgress = new client.Gauge({
  name: 'batch_job_progress',
  help: 'Batch job progress (current/total)',
  labelNames: ['job_type', 'metric'],
  registers: [register],
});

const batchJobDuration = new client.Histogram({
  name: 'batch_job_duration_seconds',
  help: 'Batch job duration in seconds',
  labelNames: ['job_type', 'status'],
  buckets: [10, 30, 60, 120, 300, 600],
  registers: [register],
});

const metrics = {
  ticksCounter,
  ticksPerSecond,
  invalidTicksCounter,
  websocketConnections,
  websocketPackets,
  websocketDataBytes,
  reconnectionAttempts,
  kafkaMessagesSent,
  errorCounter,
  externalApiCalls,
  externalApiLatency,
  batchJobStatus,
  batchJobProgress,
  batchJobDuration,
};

module.exports = { metrics, register };
