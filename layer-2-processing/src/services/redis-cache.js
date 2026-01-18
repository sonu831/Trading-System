const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;

/**
 * Connect to Redis
 */
async function connectRedis() {
  try {
    client = createClient({ url: REDIS_URL });

    client.on('error', (err) => {
      console.error('❌ Redis Client Error:', err.message);
    });

    await client.connect();
    console.log(`✅ Connected to Redis: ${REDIS_URL}`);
    return client;
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err.message);
    throw err;
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
    console.error(`❌ Redis SET failed for ${key}: ${err.message}`);
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
    console.error(`❌ Redis GET failed for ${key}: ${err.message}`);
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
    console.error(`❌ Redis SET failed for ${key}: ${err.message}`);
  }
}

/**
 * Disconnect Redis
 */
async function disconnectRedis() {
  if (client) {
    await client.quit();
    console.log('🛑 Redis disconnected.');
  }
}

module.exports = {
  connectRedis,
  getClient,
  setLatestPrice,
  getLatestPrice,
  setLatestCandle,
  disconnectRedis,
};
