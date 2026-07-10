/**
 * @trading-system/health-check
 *
 * Shared health check utilities for Trading System services.
 * Single source of truth for all dependency health checks.
 *
 * Usage:
 *   const { waitForAll, waitForKafka, waitForRedis, waitForTimescale } = require('@trading-system/health-check');
 *
 *   // Wait for all dependencies
 *   await waitForAll({
 *     kafka: { brokers: ['kafka:29092'], topic: 'raw-ticks' },
 *     redis: { url: 'redis://redis:6379' },
 *     timescale: { connectionString: 'postgresql://...', requiredTables: ['candles_1m'] },
 *   });
 *
 *   // Or wait for individual services
 *   await waitForKafka({ brokers: ['kafka:29092'], topic: 'raw-ticks' });
 *   const redisClient = await waitForRedis({ url: 'redis://redis:6379' });
 *   const pgPool = await waitForTimescale({ connectionString: '...' });
 */

const { waitForKafka, checkKafkaHealth } = require('./kafka');
const { waitForRedis, checkRedisHealth } = require('./redis');
const { waitForTimescale, checkTimescaleHealth } = require('./timescale');
const healthMetrics = require('./metrics');

/**
 * Default configuration for all health checks
 */
const DEFAULT_CONFIG = {
  maxRetries: 20,
  delayMs: 3000,
};

/**
 * Wait for all specified dependencies to be ready
 * @param {Object} dependencies - Dependencies to wait for
 * @param {Object} [dependencies.kafka] - Kafka config { brokers, topic }
 * @param {Object} [dependencies.redis] - Redis config { url }
 * @param {Object} [dependencies.timescale] - TimescaleDB config { connectionString, requiredTables }
 * @param {Object} [options] - Global options
 * @param {Function} [options.logger=console] - Logger instance
 * @param {boolean} [options.parallel=false] - Wait in parallel (faster but less clear logs)
 * @returns {Promise<Object>} - Object with connected clients { redis, timescale }
 */
async function waitForAll(dependencies, options = {}) {
  const { logger = console, parallel = false, metricsRegistry = null } = options;
  const results = {};
  const startTime = Date.now();

  // Normalize logger - support both console (log) and pino (info)
  const log = (msg) => (logger.info || logger.log).call(logger, msg);

  // Initialize metrics if registry provided
  if (metricsRegistry) {
    healthMetrics.initHealthMetrics(metricsRegistry);
  }

  log('');
  log('╔════════════════════════════════════════════════════════════╗');
  log('║     ⏳ WAITING FOR INFRASTRUCTURE DEPENDENCIES             ║');
  log('╚════════════════════════════════════════════════════════════╝');
  log('');

  const checks = [];

  if (dependencies.kafka) {
    const kafkaCheck = async () => {
      await waitForKafka({ ...dependencies.kafka, logger });
    };
    if (parallel) {
      checks.push(kafkaCheck());
    } else {
      await kafkaCheck();
    }
  }

  if (dependencies.redis) {
    const redisCheck = async () => {
      results.redis = await waitForRedis({ ...dependencies.redis, logger });
    };
    if (parallel) {
      checks.push(redisCheck());
    } else {
      await redisCheck();
    }
  }

  if (dependencies.timescale) {
    const timescaleCheck = async () => {
      results.timescale = await waitForTimescale({ ...dependencies.timescale, logger });
    };
    if (parallel) {
      checks.push(timescaleCheck());
    } else {
      await timescaleCheck();
    }
  }

  // If parallel mode, wait for all checks
  if (parallel && checks.length > 0) {
    await Promise.all(checks);
  }

  // Record startup duration and overall health
  const startupDuration = Date.now() - startTime;
  healthMetrics.recordStartupDuration(startupDuration);
  healthMetrics.recordOverallHealth(true);

  log('');
  log('✅ All infrastructure dependencies ready!');
  log('─'.repeat(60));
  log('');

  return results;
}

/**
 * Check health of all specified dependencies (single attempt each)
 * @param {Object} dependencies - Dependencies to check
 * @returns {Promise<Object>} - Health status for each dependency
 */
async function checkAllHealth(dependencies) {
  const results = {
    healthy: true,
    services: {},
  };

  if (dependencies.kafka) {
    results.services.kafka = await checkKafkaHealth(dependencies.kafka);
    if (!results.services.kafka.healthy) results.healthy = false;
  }

  if (dependencies.redis) {
    results.services.redis = await checkRedisHealth(dependencies.redis);
    if (!results.services.redis.healthy) results.healthy = false;
  }

  if (dependencies.timescale) {
    results.services.timescale = await checkTimescaleHealth(dependencies.timescale);
    if (!results.services.timescale.healthy) results.healthy = false;
  }

  return results;
}

module.exports = {
  // Main functions
  waitForAll,
  checkAllHealth,

  // Individual health checks
  waitForKafka,
  waitForRedis,
  waitForTimescale,

  // Single-attempt health checks
  checkKafkaHealth,
  checkRedisHealth,
  checkTimescaleHealth,

  // Metrics (for Grafana)
  initHealthMetrics: healthMetrics.initHealthMetrics,
  recordHealthCheck: healthMetrics.recordHealthCheck,
  recordRetry: healthMetrics.recordRetry,
  recordOverallHealth: healthMetrics.recordOverallHealth,
  getHealthStatus: healthMetrics.getHealthStatus,

  // Configuration
  DEFAULT_CONFIG,
};
