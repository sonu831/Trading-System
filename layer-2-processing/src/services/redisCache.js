const { createClient } = require('redis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;

/**
 * Connect to Redis with retries
 */
async function connectRedis(maxRetries = 20, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = createClient({ url: REDIS_URL });

      client.on('error', (err) => {
        // Only log non-connection errors (connection errors handled in retry loop)
        if (!err.message.includes('ECONNREFUSED')) {
          logger.error({ err }, 'Redis Client Error');
        }
      });

      await client.connect();
      logger.info(`Connected to Redis: ${REDIS_URL}`);
      return client;
    } catch (err) {
      if (attempt === maxRetries) {
        logger.error({ err }, `Failed to connect to Redis after ${maxRetries} attempts`);
        throw err;
      }
      logger.info(`Waiting for Redis... (${attempt}/${maxRetries}) - ${err.message}`);
      // Clean up failed client before retrying
      if (client) {
        try { await client.quit(); } catch (e) { /* ignore */ }
        client = null;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Get the Redis client instance
 */
function getClient() {
  if (!client) {
    throw new Error('Redis client not connected. Call connectRedis() first.');
  }
  return client;
}

/**
 * Cache the latest price for a symbol (Hot Data)
 * Key: ltp:{symbol} -> { price, time, volume }
 * TTL: 60 seconds (refreshed on each update)
 *
 * @param {string} symbol
 * @param {Object} data - { price, time, volume, ... }
 */
async function setLatestPrice(symbol, data) {
  if (!client) return;

  const key = `ltp:${symbol}`;
  try {
    await client.set(key, JSON.stringify(data), { EX: 60 });
  } catch (err) {
    logger.error({ err, key }, 'Redis SET failed');
  }
}

/**
 * Get the latest price for a symbol
 * @param {string} symbol
 * @returns {Object|null}
 */
async function getLatestPrice(symbol) {
  if (!client) return null;

  const key = `ltp:${symbol}`;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.error({ err, key }, 'Redis GET failed');
    return null;
  }
}

/**
 * Cache the latest candle for a symbol (for dashboard)
 * Key: candle:{symbol}:{interval} -> { time, open, high, low, close, volume }
 *
 * @param {string} symbol
 * @param {string} interval - e.g., '1m', '5m'
 * @param {Object} candle
 */
async function setLatestCandle(symbol, interval, candle) {
  if (!client) return;

  const key = `candle:${symbol}:${interval}`;
  try {
    await client.set(key, JSON.stringify(candle), { EX: 120 });
  } catch (err) {
    logger.error({ err, key }, 'Redis SET failed');
  }
}

/**
 * Disconnect Redis
 */
async function disconnectRedis() {
  if (client) {
    await client.quit();
    logger.info('Redis disconnected');
  }
}

module.exports = {
  connectRedis,
  getClient,
  setLatestPrice,
  getLatestPrice,
  setLatestCandle,
  disconnectRedis,
  setMetrics: async (metrics) => {
    if (!client) return;
    try {
      await client.set('system:layer2:metrics', JSON.stringify(metrics));
    } catch (e) {
      logger.error({ err: e }, 'Metric publish error');
    }
  },

  /**
   * Publish an event to a specific channel
   * @param {string} channel
   * @param {Object} message
   */
  publishEvent: async (channel, message) => {
    if (!client) return;
    try {
      await client.publish(channel, JSON.stringify(message));
    } catch (e) {
      logger.error({ err: e, channel }, 'Event publish error');
    }
  },
};
