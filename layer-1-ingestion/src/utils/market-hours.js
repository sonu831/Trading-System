const { DateTime } = require('luxon');

class MarketHours {
  constructor() {
    this.marketOpenTime = { hour: 9, minute: 15 };
    this.marketCloseTime = { hour: 15, minute: 30 };
    this.timeZone = 'Asia/Kolkata';
  }

  /**
   * Check if the market is currently open.
   * @returns {boolean}
   */
  isMarketOpen() {
    const now = DateTime.now().setZone(this.timeZone);

    // Check Weekend
    if (now.weekday > 5) {
      // 6 = Saturday, 7 = Sunday
      return false;
    }

    // Check Time Range
    const start = now.set(this.marketOpenTime);
    const end = now.set(this.marketCloseTime);

    // If current time is between 9:15 and 15:30
    return now >= start && now <= end;
  }

  /**
   * Get the current trading date/time status.
   * Used to determine query parameters for historical data.
   */
  getMarketStatus() {
    const isOpen = this.isMarketOpen();
    const now = DateTime.now().setZone(this.timeZone);
    return {
      isOpen,
      timestamp: now.toISO(),
      message: isOpen ? 'Market is Open' : 'Market is Closed',
    };
  }
}

module.exports = { MarketHours };
