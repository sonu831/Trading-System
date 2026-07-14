const { DateTime } = require('luxon');
import type { DateTime as LuxonDateTime } from 'luxon';

// Market hours from shared constants (single source of truth — rule 3/14)
let MARKET_HOURS: any;
try { MARKET_HOURS = require('/app/shared/constants').MARKET_HOURS; } catch (_) {
  try { MARKET_HOURS = require('../../shared/constants').MARKET_HOURS; } catch (_) {}
}
const OPEN = MARKET_HOURS?.OPEN_HOUR ?? 9;
const OPEN_M = MARKET_HOURS?.OPEN_MINUTE ?? 15;
const CLOSE = MARKET_HOURS?.CLOSE_HOUR ?? 15;
const CLOSE_M = MARKET_HOURS?.CLOSE_MINUTE ?? 30;
const TZ = MARKET_HOURS?.TIMEZONE || 'Asia/Kolkata';
const WEEKEND = MARKET_HOURS?.WEEKEND_DAYS || [0, 6];

class MarketHours {
  marketOpenTime: { hour: number; minute: number };
  marketCloseTime: { hour: number; minute: number };
  timeZone: string;

  constructor() {
    this.marketOpenTime = { hour: OPEN, minute: OPEN_M };
    this.marketCloseTime = { hour: CLOSE, minute: CLOSE_M };
    this.timeZone = TZ;
  }

  /** Canonical method — every vendor calls this. */
  getMarketStatus(): { isOpen: boolean; nextOpen: LuxonDateTime; tz: string } {
    return {
      isOpen: this.isMarketOpen(),
      nextOpen: this.nextOpen(),
      tz: this.timeZone,
    };
  }

  isMarketOpen(): boolean {
    const now: LuxonDateTime = DateTime.now().setZone(this.timeZone);
    if (WEEKEND.includes(now.weekday)) return false;
    const minutes = now.hour * 60 + now.minute;
    return minutes >= this.marketOpenTime.hour * 60 + this.marketOpenTime.minute
        && minutes <= this.marketCloseTime.hour * 60 + this.marketCloseTime.minute;
  }

  isPreMarket(): boolean {
    const now = DateTime.now().setZone(this.timeZone);
    if (WEEKEND.includes(now.weekday)) return false;
    return (now.hour * 60 + now.minute) < (this.marketOpenTime.hour * 60 + this.marketOpenTime.minute);
  }

  nextOpen(): LuxonDateTime {
    let d = DateTime.now().setZone(this.timeZone)
      .set({ hour: this.marketOpenTime.hour, minute: this.marketOpenTime.minute, second: 0, millisecond: 0 });
    if (WEEKEND.includes(d.weekday) || d < DateTime.now().setZone(this.timeZone)) {
      d = d.plus({ days: 1 });
      while (WEEKEND.includes(d.weekday)) d = d.plus({ days: 1 });
    }
    return d;
  }
}

module.exports = { MarketHours };