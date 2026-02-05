const { DateTime } = require('luxon');
const { logger } = require('../utils/logger');

class HistoricalChunker {
  /**
   * Split a date range into API-safe chunks based on the candle interval.
   *
   * **Why this exists ("Midnight Bug" & API limit):**
   * The MStock historical API returns at most ~1000 candles per request.
   * For ONE_MINUTE data, a single trading day produces ~375 candles
   * (09:15–15:30 IST), so we can safely fetch 2 days per chunk (750 < 1000).
   *
   * Additionally, date strings **must** include explicit times:
   *   - `fromDate` → `YYYY-MM-DD 09:15:00` (market open)
   *   - `toDate`   → `YYYY-MM-DD 15:30:00` (market close)
   * A bare date like `2025-01-02` resolves to `00:00:00` (midnight), which
   * falls before market open and causes the API to return zero rows.
   *
   * @param {Object} params
   * @param {string} params.fromDate - Start date (YYYY-MM-DD or ISO)
   * @param {string} params.toDate   - End date (YYYY-MM-DD or ISO)
   * @param {string} params.interval - Candle interval enum (e.g. 'ONE_MINUTE')
   * @returns {Array<{fromDate: string, toDate: string}>} Chunked date ranges
   */
  static splitRange(params) {
    const start = DateTime.fromISO(params.fromDate || params.fromdate);
    const end = DateTime.fromISO(params.toDate || params.todate).set({ hour: 15, minute: 30, second: 0 });

    if (!start.isValid || !end.isValid) return [];

    /**
     * Chunk sizes derived from the MStock API 1000-candle limit.
     * Each trading day has ~375 one-minute candles (09:15–15:30 IST).
     */
    const CHUNK_DAYS_BY_INTERVAL = {
      ONE_MINUTE: 2,       // 2 * 375 = 750 candles
      THREE_MINUTE: 10,    // 10 * 125 = 1250 (some margin)
      FIVE_MINUTE: 15,     // 15 * 75 = ~675
      TEN_MINUTE: 30,      // 30 * 38 = ~675
      FIFTEEN_MINUTE: 45,  // 45 * 25 = ~675
      THIRTY_MINUTE: 90,   // 90 * 13 = ~675
      ONE_HOUR: 150,       // 150 * 6 = ~900
      ONE_DAY: 365,        // 365 * 1 = 365
    };

    const chunkDays = CHUNK_DAYS_BY_INTERVAL[params.interval] || 1;

    const chunks = [];
    let currentStart = start.set({ hour: 9, minute: 15, second: 0 });
    const finalEnd = end;

    while (currentStart < finalEnd) {
      let chunkEndDate = currentStart
        .plus({ days: chunkDays - 1 })
        .set({ hour: 15, minute: 30, second: 0 });

      if (chunkEndDate > finalEnd) {
        chunkEndDate = finalEnd;
      }

      chunks.push({
        fromDate: currentStart.toFormat('yyyy-MM-dd HH:mm:ss'),
        toDate: chunkEndDate.toFormat('yyyy-MM-dd HH:mm:ss'),
      });

      currentStart = chunkEndDate.plus({ days: 1 }).set({ hour: 9, minute: 15, second: 0 });
    }

    return chunks;
  }
}

module.exports = { HistoricalChunker };
