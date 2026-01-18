const { pool } = require('../db/client');

/**
 * Insert a single candle into the candles_1m hypertable.
 * @param {Object} candle - The candle object
 * @param {string} candle.symbol - Stock symbol (e.g., "RELIANCE")
 * @param {string} candle.timestamp - ISO timestamp or "yyyy-MM-dd HH:mm"
 * @param {number} candle.open
 * @param {number} candle.high
 * @param {number} candle.low
 * @param {number} candle.close
 * @param {number} candle.volume
 */
async function insertCandle(candle) {
  const query = `
        INSERT INTO candles_1m (time, symbol, exchange, open, high, low, close, volume)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT DO NOTHING
    `;

  const values = [
    candle.timestamp,
    candle.symbol,
    candle.exchange || 'NSE',
    candle.open,
    candle.high,
    candle.low,
    candle.close,
    candle.volume,
  ];

  try {
    await pool.query(query, values);
  } catch (err) {
    console.error(`❌ Insert failed for ${candle.symbol}: ${err.message}`);
  }
}

/**
 * Batch insert candles for efficiency.
 * @param {Array<Object>} candles - Array of candle objects
 */
async function insertCandlesBatch(candles) {
  if (!candles || candles.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const candle of candles) {
      const query = `
                INSERT INTO candles_1m (time, symbol, exchange, open, high, low, close, volume)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT DO NOTHING
            `;
      const values = [
        candle.timestamp,
        candle.symbol,
        candle.exchange || 'NSE',
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
      ];
      await client.query(query, values);
    }

    await client.query('COMMIT');
    console.log(`✅ Inserted batch of ${candles.length} candles.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`❌ Batch insert failed: ${err.message}`);
  } finally {
    client.release();
  }
}

module.exports = {
  insertCandle,
  insertCandlesBatch,
};
