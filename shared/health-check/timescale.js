/**
 * TimescaleDB Health Check
 *
 * Waits for TimescaleDB/PostgreSQL to be available and optionally
 * verifies that required tables exist.
 */

const { recordHealthCheck, recordRetry } = require('./metrics');

const DEFAULT_CONFIG = {
  maxRetries: 20,
  delayMs: 3000,
  connectionTimeout: 10000,
};

/**
 * Wait for TimescaleDB to be ready
 * @param {Object} options - Configuration options
 * @param {string} options.connectionString - PostgreSQL connection string
 * @param {string[]} [options.requiredTables] - Tables to verify exist (optional)
 * @param {number} [options.maxRetries=20] - Maximum retry attempts
 * @param {number} [options.delayMs=3000] - Delay between retries in ms
 * @param {Function} [options.logger=console] - Logger instance
 * @returns {Promise<Object>} - pg Pool instance
 */
async function waitForTimescale(options) {
  const {
    connectionString,
    requiredTables = [],
    maxRetries = DEFAULT_CONFIG.maxRetries,
    delayMs = DEFAULT_CONFIG.delayMs,
    connectionTimeout = DEFAULT_CONFIG.connectionTimeout,
    logger = console,
  } = options;

  // Normalize logger - support both console (log) and pino (info)
  const log = (msg) => (logger.info || log).call(logger, msg);
  const logWarn = (msg) => (logger.warn || log).call(logger, msg);
  const logError = (msg) => (logger.error || log).call(logger, msg);

  if (!connectionString) {
    throw new Error('TimescaleDB connection string is required');
  }

  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: connectionTimeout,
  });
  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let client = null;
    try {
      client = await pool.connect();

      // Verify connection
      await client.query('SELECT 1');
      log('✅ Connected to TimescaleDB');

      // Verify required tables exist
      for (const table of requiredTables) {
        const res = await client.query(`SELECT to_regclass('public.${table}');`);
        if (res.rows[0].to_regclass) {
          log(`✅ Table '${table}' verified`);
        } else {
          logWarn(`⚠️ Table '${table}' not found - may need migrations`);
        }
      }

      client.release();
      // Record success
      recordHealthCheck('timescale', true, Date.now() - startTime);
      return pool;

    } catch (error) {
      if (client) {
        try { client.release(); } catch (e) {}
      }

      if (attempt === maxRetries) {
        recordHealthCheck('timescale', false, Date.now() - startTime);
        logError(`❌ TimescaleDB not ready after ${maxRetries} attempts: ${error.message}`);
        await pool.end();
        throw error;
      }
      recordRetry('timescale');
      log(`⏳ Waiting for TimescaleDB... (${attempt}/${maxRetries}) - ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return null;
}

/**
 * Check TimescaleDB health (single attempt)
 * @param {Object} options - Configuration options
 * @returns {Promise<{healthy: boolean, message: string}>}
 */
async function checkTimescaleHealth(options) {
  let pool = null;
  try {
    pool = await waitForTimescale({ ...options, maxRetries: 1 });
    await pool.end();
    return { healthy: true, message: 'TimescaleDB is healthy' };
  } catch (error) {
    if (pool) {
      try { await pool.end(); } catch (e) {}
    }
    return { healthy: false, message: error.message };
  }
}

module.exports = {
  waitForTimescale,
  checkTimescaleHealth,
  DEFAULT_CONFIG,
};
