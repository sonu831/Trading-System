const { Pool } = require('pg');
const dotenv = require('dotenv');
const logger = require('../utils/logger');

dotenv.config();

const connectionString =
  process.env.TIMESCALE_URL || 'postgresql://trading:trading123@timescaledb:5432/nifty50';

const pool = new Pool({
  connectionString,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle DB client');
  process.exit(-1);
});

/**
 * Wait for TimescaleDB to be ready with retries
 */
async function connectDB(maxRetries = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await pool.connect();
      logger.info('Connected to TimescaleDB');

      // Verify schema exists
      const res = await client.query("SELECT to_regclass('public.candles_1m');");
      if (res.rows[0].to_regclass) {
        logger.info("'candles_1m' hypertable verified");
      } else {
        logger.warn("'candles_1m' table NOT found. Please run migrations.");
      }

      client.release();
      return; // Success - exit the retry loop
    } catch (err) {
      if (attempt === maxRetries) {
        logger.error({ err }, `Failed to connect to TimescaleDB after ${maxRetries} attempts`);
        throw err;
      }
      logger.info(`Waiting for TimescaleDB... (${attempt}/${maxRetries}) - ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = {
  pool,
  connectDB,
};
