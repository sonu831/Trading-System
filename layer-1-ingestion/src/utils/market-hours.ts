const { DateTime } = require('luxon');
import type { DateTime as LuxonDateTime } from 'luxon';

class MarketHours {
  marketOpenTime: { hour: number; minute: number };
  marketCloseTime: { hour: number; minute: number };
  timeZone: string;

  constructor() { this.marketOpenTime = { hour: 9, minute: 15 }; this.marketCloseTime = { hour: 15, minute: 30 }; this.timeZone = 'Asia/Kolkata'; }

  isMarketOpen(): boolean {
    const now: LuxonDateTime = DateTime.now().setZone(this.timeZone);
    if (now.weekday > 5) return false;
    const minutes = now.hour * 60 + now.minute;
    return minutes >= this.marketOpenTime.hour * 60 + this.marketOpenTime.minute && minutes <= this.marketCloseTime.hour * 60 + this.marketCloseTime.minute;
  }

  isPreMarket(): boolean {
    const now = DateTime.now().setZone(this.timeZone);
    if (now.weekday > 5) return false;
    return (now.hour * 60 + now.minute) < (this.marketOpenTime.hour * 60 + this.marketOpenTime.minute);
  }

  nextOpen(): LuxonDateTime {
    let d = DateTime.now().setZone(this.timeZone).set({ hour: this.marketOpenTime.hour, minute: this.marketOpenTime.minute, second: 0, millisecond: 0 });
    if (d.weekday > 5 || d < DateTime.now().setZone(this.timeZone)) { d = d.plus({ days: 1 }); while (d.weekday > 5) d = d.plus({ days: 1 }); }
    return d;
  }
}

export = { MarketHours };
