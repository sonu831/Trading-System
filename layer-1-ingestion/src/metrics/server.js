const promClient = require('prom-client');
const express = require('express');

// Create registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const ticksReceived = new promClient.Counter({
  name: 'ingestion_ticks_total',
  help: 'Total WebSocket ticks received',
  labelNames: ['symbol', 'vendor'],
  registers: [register],
});

const kafkaMessagesSent = new promClient.Counter({
  name: 'kafka_messages_sent_total',
  help: 'Total Kafka messages published',
  labelNames: ['topic'],
  registers: [register],
});

const websocketConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Active WebSocket connections',
  registers: [register],
});

const externalApiCalls = new promClient.Counter({
  name: 'external_api_calls_total',
  help: 'External API calls',
  labelNames: ['vendor', 'endpoint', 'status'],
  registers: [register],
});

const externalApiLatency = new promClient.Histogram({
  name: 'external_api_latency_seconds',
  help: 'External API latency',
  labelNames: ['vendor', 'endpoint'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// HTTP request metrics (for Grafana queries)
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Expose /metrics endpoint
const app = express();
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'layer-1-ingestion-metrics' });
});

const METRICS_PORT = process.env.METRICS_PORT || 9091;

function startMetricsServer() {
  app.listen(METRICS_PORT, () => {
    console.log(`📊 Metrics server running on :${METRICS_PORT}`);
  });
}

module.exports = {
  ticksReceived,
  kafkaMessagesSent,
  websocketConnections,
  externalApiCalls,
  externalApiLatency,
  httpRequestDuration,
  startMetricsServer,
};
