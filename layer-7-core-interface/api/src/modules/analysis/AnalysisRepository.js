const { Prisma } = require('@prisma/client');
const { Pool } = require('pg');
const Cursor = require('pg-cursor');

// Initialize PG Pool for Streaming (Prisma doesn't support cursors natively)
const pool = new Pool({
  connectionString: process.env.TIMESCALE_URL || process.env.DATABASE_URL,
  max: 5 // Keep pool small, mostly for streaming
});

/**
 * @class AnalysisRepository
 * @description Repository for fetching candle data from TimescaleDB.
 * Queries appropriate continuous aggregates based on interval.
 */
class AnalysisRepository {
  /**
   * @param {Object} dependencies
   * @param {PrismaClient} dependencies.prisma - Prisma client instance
   */
  constructor({ prisma }) {
    this.prisma = prisma;
  }

  /**
   * Map interval string to table name
   */
  static INTERVAL_TABLE_MAP = {
    '1m': 'candles_1m',
    '5m': 'candles_5m',
    '10m': 'candles_10m',
    '15m': 'candles_15m',
    '30m': 'candles_30m',
    '1h': 'candles_1h',
    '4h': 'candles_4h', // Now uses continuous aggregate
    '1d': 'candles_1d',
    '1w': 'candles_weekly',
  };

  /**
   * Fetch candle data for a symbol at specified interval
   * @param {string} symbol - Stock symbol (e.g., RELIANCE)
   * @param {string} interval - Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w)
   * @param {number} limit - Number of candles to fetch
   * @returns {Promise<Array>} Array of candle objects
   */
  async getCandles(symbol, interval = '15m', limit = 500) {
    const tableName = AnalysisRepository.INTERVAL_TABLE_MAP[interval];

    let rows;

    if (tableName) {
      // Use existing continuous aggregate
      rows = await this.prisma.$queryRawUnsafe(
        `SELECT time, open, high, low, close, volume
         FROM ${tableName}
         WHERE symbol = $1
         ORDER BY time DESC
         LIMIT $2`,
        symbol,
        limit
      );
    } else if (interval === '4h') {
      // On-the-fly aggregation for 4h
      rows = await this.prisma.$queryRaw`
        SELECT 
          time_bucket('4 hours', time) AS time,
          first(open, time) AS open,
          max(high) AS high,
          min(low) AS low,
          last(close, time) AS close,
          sum(volume) AS volume
        FROM candles_1m
        WHERE symbol = ${symbol}
          AND time > NOW() - INTERVAL '90 days'
        GROUP BY time_bucket('4 hours', time)
        ORDER BY time DESC
        LIMIT ${limit}
      `;
    } else {
      throw new Error(`Unsupported interval: ${interval}`);
    }

    // Return in ascending order for charting (reverse DESC order)
    return rows.reverse().map((row) => ({
      time: row.time,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
    }));
  }

  /**
   * Fetch the latest price for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Latest price data
   */
  async getLatestPrice(symbol) {
    const rows = await this.prisma.$queryRaw`
      SELECT time, open, high, low, close, volume
      FROM candles_1m
      WHERE symbol = ${symbol}
      ORDER BY time DESC
      LIMIT 1
    `;

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      time: row.time,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
    };
  }

  /**
   * Fetch previous day's close for change calculation
   * @param {string} symbol - Stock symbol
   * @returns {Promise<number|null>} Previous close price
   */
  async getPreviousClose(symbol) {
    const rows = await this.prisma.$queryRaw`
      SELECT close
      FROM candles_1d
      WHERE symbol = ${symbol}
      ORDER BY time DESC
      LIMIT 1 OFFSET 1
    `;

    return rows[0]?.close ? parseFloat(rows[0].close) : null;
  }

  /**
   * Fetch candles for multiple timeframes (for multi-TF summary)
   * Uses Promise.all for parallel fetching - high performance
   * @param {string} symbol - Stock symbol
   * @param {number} lookback - Number of candles per timeframe
   * @returns {Promise<Object>} Candles keyed by interval
   */
  async getMultiTimeframeCandles(symbol, lookback = 50) {
    const intervals = ['5m', '15m', '1h', '4h', '1d', '1w'];

    // Parallel fetch for high performance
    const results = await Promise.all(
      intervals.map(async (interval) => {
        try {
          const candles = await this.getCandles(symbol, interval, lookback);
          return { interval, candles };
        } catch (err) {
          return { interval, candles: [], error: err.message };
        }
      })
    );

    return results.reduce((acc, { interval, candles }) => {
      acc[interval] = candles;
      return acc;
    }, {});
  }

  /**
   * Check if options data exists for a symbol
   * @param {string} symbol - Stock symbol
   * @returns {Promise<boolean>}
   */
  async hasOptionsData(symbol) {
    try {
      const result = await this.prisma.$queryRaw`
        SELECT EXISTS(
          SELECT 1 FROM options_chain
          WHERE symbol = ${symbol}
            AND expiry >= CURRENT_DATE
          LIMIT 1
        ) as has_data
      `;
      return result[0]?.has_data || false;
    } catch (err) {
      // Table may not exist
      return false;
    }
  }

  /**
   * Fetch latest options chain for PCR calculation
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Array>} Options chain data
   */
  async getOptionsChain(symbol) {
    try {
      // Get nearest expiry with data
      const expiry = await this.prisma.$queryRaw`
        SELECT DISTINCT expiry
        FROM options_chain
        WHERE symbol = ${symbol}
          AND expiry >= CURRENT_DATE
        ORDER BY expiry ASC
        LIMIT 1
      `;

      if (!expiry || expiry.length === 0) return [];

      // Get latest snapshot for that expiry
      return this.prisma.$queryRaw`
        SELECT strike, option_type, oi, volume, iv, ltp, delta, gamma, theta, vega
        FROM options_chain
        WHERE symbol = ${symbol}
          AND expiry = ${expiry[0].expiry}
          AND snapshot_time = (
            SELECT MAX(snapshot_time) FROM options_chain
            WHERE symbol = ${symbol} AND expiry = ${expiry[0].expiry}
          )
        ORDER BY strike ASC
      `;
    } catch (err) {
      return [];
    }
  }

  /**
   * Fetch extended historical data for backtesting
   * High performance: fetches up to 2500 daily candles (10 years)
   * @param {string} symbol - Stock symbol
   * @param {number} days - Number of days (default 2500)
   * @returns {Promise<Array>} Daily candles
   */
  async getHistoricalCandles(symbol, days = 2500) {
    const rows = await this.prisma.$queryRaw`
      SELECT time, open, high, low, close, volume
      FROM candles_1d
      WHERE symbol = ${symbol}
      ORDER BY time DESC
      LIMIT ${days}
    `;

    // Return in ascending order (oldest first)
    return rows.reverse().map((row) => ({
      time: row.time,
      open: parseFloat(row.open),
      high: parseFloat(row.high),
      low: parseFloat(row.low),
      close: parseFloat(row.close),
      volume: parseFloat(row.volume),
    }));
  }

  /**
   * Batch fetch candles for multiple symbols (high performance)
   * Uses parallel queries with p-limit pattern
   * @param {Array<string>} symbols - Array of stock symbols
   * @param {string} interval - Timeframe
   * @param {number} limit - Candles per symbol
   * @returns {Promise<Object>} Candles keyed by symbol
   */
  async getBatchCandles(symbols, interval = '1d', limit = 100) {
    const results = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const candles = await this.getCandles(symbol, interval, limit);
          return { symbol, candles };
        } catch (err) {
          return { symbol, candles: [], error: err.message };
        }
      })
    );

    return results.reduce((acc, { symbol, candles }) => {
      acc[symbol] = candles;
      return acc;
    }, {});
  }

  /**
   * Stream candles using Postgres Cursor (High Performance)
   * Essential for backtesting millions of rows
   * @param {string} symbol
   * @param {string} interval
   * @param {Function} callback - batch processor
   */
  async streamCandles(symbol, interval = '1m', batchSize = 10000, callback) {
    const client = await pool.connect();
    try {
      // Optimize session for throughput
      await client.query('SET max_parallel_workers_per_gather = 8;');
      
      const tableName = AnalysisRepository.INTERVAL_TABLE_MAP[interval];
      const queryText = `SELECT time, open, high, low, close, volume FROM ${tableName} WHERE symbol = $1 ORDER BY time ASC`;
      
      const cursor = client.query(new Cursor(queryText, [symbol]));

      return new Promise((resolve, reject) => {
        const fetchNext = () => {
          cursor.read(batchSize, async (err, rows) => {
            if (err) return reject(err);
            if (!rows.length) {
              // Done
              cursor.close(() => {
                client.release();
                resolve();
              });
              return;
            }

            try {
              // Transform to numbers for JS
              const candles = rows.map(r => ({
                time: r.time,
                open: parseFloat(r.open),
                high: parseFloat(r.high),
                low: parseFloat(r.low),
                close: parseFloat(r.close),
                volume: parseFloat(r.volume)
              }));
              
              // Process batch via callback (e.g., worker dispatch)
              await callback(candles);
              
              // Next batch
              fetchNext();
            } catch (pErr) {
              reject(pErr);
            }
          });
        };
        fetchNext();
      });

    } catch (err) {
      client.release();
      throw err;
    }
  }
}

module.exports = AnalysisRepository;
