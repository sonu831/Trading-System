const { DateTime } = require('luxon');
const { logger } = require('../utils/logger');

class HistoricalChunker {
  /**
   * Split a date range into smaller chunks based on candle limit.
   * @param {Object} params
   * @param {string} params.fromDate - YYYY-MM-DD
   * @param {string} params.toDate - YYYY-MM-DD
   * @param {string} params.interval - 'ONE_MINUTE', 'TEN_MINUTE', etc.
   * @returns {Array<Object>} List of { fromDate, toDate } objects
   */
  static splitRange(params) {
    const start = DateTime.fromISO(params.fromDate || params.fromdate);
    const end = DateTime.fromISO(params.toDate || params.todate);

    if (!start.isValid || !end.isValid) return [];

    // Determine chunk size based on interval
    // Limit is roughly 1000 candles.
    // 1 Minute = ~375 candles/day -> Safe limit 2 days -> 750 candles.
    // 10 Minute = ~37 candles/day -> Safe limit 25 days -> 925 candles.

    let chunkDays = 1; // Default
    switch (params.interval) {
      case 'ONE_MINUTE':
        chunkDays = 2; // Increased to 2 days to ensure non-empty overlap if needed?
        break;
      case 'THREE_MINUTE':
        chunkDays = 5;
        break;
      case 'FIVE_MINUTE':
        chunkDays = 10;
        break;
      case 'TEN_MINUTE':
        chunkDays = 20;
        break;
      case 'FIFTEEN_MINUTE':
        chunkDays = 30;
        break;
      case 'THIRTY_MINUTE':
        chunkDays = 60;
        break;
      case 'ONE_HOUR':
        chunkDays = 100;
        break;
      case 'ONE_DAY':
        chunkDays = 365;
        break;
      default:
        chunkDays = 1;
    }

    const chunks = [];
    let currentStart = start;

    while (currentStart <= end) {
      let currentEnd = currentStart.plus({ days: chunkDays });
      if (currentEnd > end) currentEnd = end;

      // Ensure fromDate is not after toDate (should be impossible with logic above)
      if (currentStart <= currentEnd) {
        chunks.push({
          fromDate: currentStart.toISODate(),
          toDate: currentEnd.toISODate(),
        });
      }

      // Move to next day
      currentStart = currentEnd.plus({ days: 1 });
    }

    return chunks;
  }
}

module.exports = { HistoricalChunker };
