/** Write candles to TimescaleDB. Idempotent via ON CONFLICT DO NOTHING. */
const { pool } = require('../db/client');
const logger = require('../utils/logger');

interface Candle { symbol: string; timestamp: string | Date; exchange?: string; open: number; high: number; low: number; close: number; volume: number; }

async function insertCandle(candle: Candle): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO candles_1m (time, symbol, exchange, open, high, low, close, volume) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [candle.timestamp, candle.symbol, candle.exchange || 'NSE', candle.open, candle.high, candle.low, candle.close, candle.volume]
    );
  } catch (err: any) { logger.error({ err, symbol: candle.symbol }, 'Insert failed'); }
}

async function insertCandlesBatch(candles: Candle[]): Promise<void> {
  if (!candles?.length) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const c of candles) {
      await client.query(
        `INSERT INTO candles_1m (time, symbol, exchange, open, high, low, close, volume) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [c.timestamp, c.symbol, c.exchange || 'NSE', c.open, c.high, c.low, c.close, c.volume]
      );
    }
    await client.query('COMMIT');
  } catch (err: any) { await client.query('ROLLBACK'); logger.error({ err }, 'Batch insert failed'); }
  finally { client.release(); }
}

module.exports = { insertCandle, insertCandlesBatch };
