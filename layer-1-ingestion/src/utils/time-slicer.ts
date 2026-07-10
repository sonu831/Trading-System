const { DateTime } = require('luxon');
const { logger } = require('./logger');

class TimeSlicer {
  /**
   * Slice a date range into partitions based on strategy.
   * @param {Object} params - { fromDate, toDate }
   * @param {string} strategy - 'MONTHLY' | 'WEEKLY'
   * @returns {Array<Object>} List of { fromDate, toDate } partitions
   */
  static slice(params, strategy) {
    const start = DateTime.fromISO(params.fromDate || params.fromdate);
    const end = DateTime.fromISO(params.toDate || params.todate).set({ hour: 15, minute: 30, second: 0 });

    if (!start.isValid || !end.isValid) {
      logger.error(`TimeSlicer: Invalid dates - ${params.fromDate} to ${params.toDate}`);
      return [];
    }

    const partitions = [];
    let current = start;

    while (current < end) {
      let partitionEnd;

      if (strategy === 'MONTHLY') {
        // End of current month
        partitionEnd = current.endOf('month').set({ hour: 15, minute: 30, second: 0 });
      } else if (strategy === 'WEEKLY') {
        // End of current week (let's say Sunday or +6 days)
        // .endOf('week') in Luxon depends on locale, usually Sunday.
        partitionEnd = current.endOf('week').set({ hour: 15, minute: 30, second: 0 });
      } else {
        // Default fallback (e.g. 1 day?)
        partitionEnd = current.plus({ days: 1 }).set({ hour: 15, minute: 30, second: 0 });
      }

      // Cap at global end date
      if (partitionEnd > end) {
        partitionEnd = end;
      }

      /**
       * Normalize partition start to market open time (09:15 IST).
       * All partitions — including the first — must align to 09:15 so the
       * broker API receives a valid trading-hours window. Without this,
       * a bare date like "2025-01-01" resolves to midnight, which can
       * cause the API to return zero rows or misinterpret the range.
       */
      const partitionStart = current.set({ hour: 9, minute: 15, second: 0 });

      // Push valid partition
      if (partitionStart < partitionEnd) {
        partitions.push({
          fromDate: partitionStart.toISO(),
          toDate: partitionEnd.toISO()
        });
      }

      // Next Iteration Start: Next Day 09:15:00
      current = partitionEnd.plus({ days: 1 }).set({ hour: 9, minute: 15, second: 0 });
    }

    logger.debug(`TimeSlicer: Sliced ${strategy} range into ${partitions.length} partitions.`);
    return partitions;
  }
}

module.exports = { TimeSlicer };
