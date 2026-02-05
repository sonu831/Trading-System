const { Prisma } = require('@prisma/client');

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
    '4h': null, // Will use time_bucket query
    '1d': 'candles_1d',
    '1w': 'candles_1w',
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
   * @param {string} symbol - Stock symbol
   * @param {number} lookback - Number of candles per timeframe
   * @returns {Promise<Object>} Candles keyed by interval
   */
  async getMultiTimeframeCandles(symbol, lookback = 50) {
    const intervals = ['15m', '1h', '1d', '1w'];
    const results = {};

    for (const interval of intervals) {
      results[interval] = await this.getCandles(symbol, interval, lookback);
    }

    return results;
  }
}

module.exports = AnalysisRepository;
