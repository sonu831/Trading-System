/**
 * Redis Health Check
 *
 * Waits for Redis to be available and connected.
 */

const { recordHealthCheck, recordRetry } = require('./metrics');

const DEFAULT_CONFIG = {
  maxRetries: 20,
  delayMs: 3000,
};

/**
 * Wait for Redis to be ready
 * @param {Object} options - Configuration options
 * @param {string} options.url - Redis connection URL
 * @param {number} [options.maxRetries=20] - Maximum retry attempts
 * @param {number} [options.delayMs=3000] - Delay between retries in ms
 * @param {Function} [options.logger=console] - Logger instance
 * @returns {Promise<Object>} - Connected Redis client
 */
async function waitForRedis(options) {
  const {
    url,
    maxRetries = DEFAULT_CONFIG.maxRetries,
    delayMs = DEFAULT_CONFIG.delayMs,
    logger = console,
  } = options;

  // Normalize logger - support both console (log) and pino (info)
  const log = (msg) => (logger.info || log).call(logger, msg);
  const logError = (msg) => (logError || log).call(logger, msg);

  if (!url) {
    throw new Error('Redis URL is required');
  }

  const { createClient } = require('redis');
  let client = null;
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = createClient({ url });

      // Suppress connection refused errors during retry
      client.on('error', (err) => {
        if (!err.message.includes('ECONNREFUSED')) {
          logError('Redis Client Error:', err.message);
        }
      });

      await client.connect();

      // Verify connection with PING
      await client.ping();

      // Record success
      recordHealthCheck('redis', true, Date.now() - startTime);
      log(`✅ Redis ready: ${url}`);
      return client;

    } catch (error) {
      // Clean up failed client
      if (client) {
        try { await client.quit(); } catch (e) {}
        client = null;
      }

      if (attempt === maxRetries) {
        recordHealthCheck('redis', false, Date.now() - startTime);
        logError(`❌ Redis not ready after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      recordRetry('redis');
      log(`⏳ Waiting for Redis... (${attempt}/${maxRetries}) - ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

/**
 * Check Redis health (single attempt)
 * @param {Object} options - Configuration options
 * @returns {Promise<{healthy: boolean, message: string}>}
 */
async function checkRedisHealth(options) {
  let client = null;
  try {
    client = await waitForRedis({ ...options, maxRetries: 1 });
    await client.quit();
    return { healthy: true, message: 'Redis is healthy' };
  } catch (error) {
    if (client) {
      try { await client.quit(); } catch (e) {}
    }
    return { healthy: false, message: error.message };
  }
}

module.exports = {
  waitForRedis,
  checkRedisHealth,
  DEFAULT_CONFIG,
};
