/** Redis cache for L2 processing — hot data for dashboard. */
const { createClient } = require('redis');
const logger = require('../utils/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let client: ReturnType<typeof createClient> | null = null;

async function connectRedis(maxRetries = 20, delayMs = 3000): Promise<ReturnType<typeof createClient>> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      client = createClient({ url: REDIS_URL });
      client.on('error', (err: Error) => { if (!err.message.includes('ECONNREFUSED')) logger.error({ err }, 'Redis error'); });
      await client.connect();
      return client;
    } catch (err: any) {
      if (attempt === maxRetries) { logger.error({ err }, `Redis failed after ${maxRetries} attempts`); throw err; }
      if (client) { try { await client.quit(); } catch (_) {} client = null; }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('connectRedis: unreachable');
}

function getClient(): ReturnType<typeof createClient> {
  if (!client) throw new Error('Redis not connected. Call connectRedis() first.');
  return client;
}

async function setLatestPrice(symbol: string, data: Record<string, unknown>): Promise<void> {
  if (!client) return;
  try { await client.set(`ltp:${symbol}`, JSON.stringify(data), { EX: 60 }); } catch (_: any) {}
}

async function getLatestPrice(symbol: string): Promise<Record<string, unknown> | null> {
  if (!client) return null;
  try { const d = await client.get(`ltp:${symbol}`); return d ? JSON.parse(d) : null; } catch (_: any) { return null; }
}

async function setLatestCandle(symbol: string, interval: string, candle: Record<string, unknown>): Promise<void> {
  if (!client) return;
  try { await client.set(`candle:${symbol}:${interval}`, JSON.stringify(candle), { EX: 120 }); } catch (_: any) {}
}

async function disconnectRedis(): Promise<void> {
  if (client) { await client.quit(); logger.info('Redis disconnected'); }
}

async function setMetrics(metrics: Record<string, unknown>): Promise<void> {
  if (!client) return;
  try { await client.set('system:layer2:metrics', JSON.stringify(metrics)); } catch (_: any) {}
}

module.exports = { connectRedis, getClient, setLatestPrice, getLatestPrice, setLatestCandle, disconnectRedis, setMetrics };
