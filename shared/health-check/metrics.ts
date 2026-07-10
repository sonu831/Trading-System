/**
 * @trading-system/health-check - Prometheus Metrics
 *
 * Exposes infrastructure health metrics for Grafana dashboards.
 * These metrics are exposed from the shared library and can be
 * collected by any service using the health-check library.
 */

let client;

try {
  client = require('prom-client');
} catch (e) {
  // prom-client is a peer dependency - warn if not available
  console.warn('prom-client not available. Health metrics will be disabled.');
  client = null;
}

// Registry for health metrics (optional - can be merged with service registry)
let metricsEnabled = false;
let healthMetrics = {};

/**
 * Initialize health metrics with a Prometheus registry
 * @param {Object} registry - prom-client Registry instance
 */
function initHealthMetrics(registry) {
  if (!client) {
    console.warn('Health metrics disabled - prom-client not installed');
    return;
  }

  const reg = registry || new client.Registry();
  metricsEnabled = true;

  // Infrastructure Health Status (1=healthy, 0=unhealthy)
  healthMetrics.kafkaHealthy = new client.Gauge({
    name: 'infrastructure_kafka_healthy',
    help: 'Kafka connection health status (1=healthy, 0=unhealthy)',
    registers: [reg],
  });

  healthMetrics.redisHealthy = new client.Gauge({
    name: 'infrastructure_redis_healthy',
    help: 'Redis connection health status (1=healthy, 0=unhealthy)',
    registers: [reg],
  });

  healthMetrics.timescaleHealthy = new client.Gauge({
    name: 'infrastructure_timescale_healthy',
    help: 'TimescaleDB connection health status (1=healthy, 0=unhealthy)',
    registers: [reg],
  });

  // Connection Latency
  healthMetrics.kafkaLatency = new client.Histogram({
    name: 'infrastructure_kafka_connect_seconds',
    help: 'Kafka connection time in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [reg],
  });

  healthMetrics.redisLatency = new client.Histogram({
    name: 'infrastructure_redis_connect_seconds',
    help: 'Redis connection time in seconds',
    buckets: [0.05, 0.1, 0.5, 1, 2, 5],
    registers: [reg],
  });

  healthMetrics.timescaleLatency = new client.Histogram({
    name: 'infrastructure_timescale_connect_seconds',
    help: 'TimescaleDB connection time in seconds',
    buckets: [0.1, 0.5, 1, 2, 5, 10],
    registers: [reg],
  });

  // Retry Counts
  healthMetrics.kafkaRetries = new client.Counter({
    name: 'infrastructure_kafka_retries_total',
    help: 'Total Kafka connection retry attempts',
    registers: [reg],
  });

  healthMetrics.redisRetries = new client.Counter({
    name: 'infrastructure_redis_retries_total',
    help: 'Total Redis connection retry attempts',
    registers: [reg],
  });

  healthMetrics.timescaleRetries = new client.Counter({
    name: 'infrastructure_timescale_retries_total',
    help: 'Total TimescaleDB connection retry attempts',
    registers: [reg],
  });

  // Kafka Topic Partitions
  healthMetrics.kafkaPartitions = new client.Gauge({
    name: 'infrastructure_kafka_partitions',
    help: 'Number of partitions for monitored Kafka topic',
    labelNames: ['topic'],
    registers: [reg],
  });

  healthMetrics.kafkaPartitionsWithLeaders = new client.Gauge({
    name: 'infrastructure_kafka_partitions_with_leaders',
    help: 'Number of Kafka partitions with active leaders',
    labelNames: ['topic'],
    registers: [reg],
  });

  // Overall System Health
  healthMetrics.allServicesHealthy = new client.Gauge({
    name: 'infrastructure_all_services_healthy',
    help: 'All infrastructure services healthy (1=all healthy, 0=one or more unhealthy)',
    registers: [reg],
  });

  // Service Startup Time
  healthMetrics.startupDuration = new client.Histogram({
    name: 'infrastructure_startup_seconds',
    help: 'Time to complete all health checks at startup',
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [reg],
  });

  return healthMetrics;
}

/**
 * Record health check result
 * @param {string} service - 'kafka', 'redis', or 'timescale'
 * @param {boolean} healthy - Whether the check passed
 * @param {number} latencyMs - Connection latency in milliseconds
 * @param {Object} extra - Additional data (e.g., partitions for Kafka)
 */
function recordHealthCheck(service, healthy, latencyMs, extra = {}) {
  if (!metricsEnabled) return;

  const latencySec = latencyMs / 1000;

  switch (service) {
    case 'kafka':
      healthMetrics.kafkaHealthy?.set(healthy ? 1 : 0);
      healthMetrics.kafkaLatency?.observe(latencySec);
      if (extra.partitions !== undefined) {
        healthMetrics.kafkaPartitions?.set({ topic: extra.topic || 'unknown' }, extra.partitions);
      }
      if (extra.partitionsWithLeaders !== undefined) {
        healthMetrics.kafkaPartitionsWithLeaders?.set({ topic: extra.topic || 'unknown' }, extra.partitionsWithLeaders);
      }
      break;
    case 'redis':
      healthMetrics.redisHealthy?.set(healthy ? 1 : 0);
      healthMetrics.redisLatency?.observe(latencySec);
      break;
    case 'timescale':
      healthMetrics.timescaleHealthy?.set(healthy ? 1 : 0);
      healthMetrics.timescaleLatency?.observe(latencySec);
      break;
  }
}

/**
 * Record a retry attempt
 * @param {string} service - 'kafka', 'redis', or 'timescale'
 */
function recordRetry(service) {
  if (!metricsEnabled) return;

  switch (service) {
    case 'kafka':
      healthMetrics.kafkaRetries?.inc();
      break;
    case 'redis':
      healthMetrics.redisRetries?.inc();
      break;
    case 'timescale':
      healthMetrics.timescaleRetries?.inc();
      break;
  }
}

/**
 * Record overall health status
 * @param {boolean} allHealthy - Whether all services are healthy
 */
function recordOverallHealth(allHealthy) {
  if (!metricsEnabled) return;
  healthMetrics.allServicesHealthy?.set(allHealthy ? 1 : 0);
}

/**
 * Record startup duration
 * @param {number} durationMs - Total startup time in milliseconds
 */
function recordStartupDuration(durationMs) {
  if (!metricsEnabled) return;
  healthMetrics.startupDuration?.observe(durationMs / 1000);
}

/**
 * Get current health metrics values (for JSON endpoints)
 */
function getHealthStatus() {
  return {
    metricsEnabled,
    // Metrics are exposed via Prometheus scraping
    // This function can be extended to return current values if needed
  };
}

module.exports = {
  initHealthMetrics,
  recordHealthCheck,
  recordRetry,
  recordOverallHealth,
  recordStartupDuration,
  getHealthStatus,
  healthMetrics,
};
