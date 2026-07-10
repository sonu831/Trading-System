/**
 * IST time helpers. All trading-session logic (entry cutoff, square-off, expiry)
 * must use these, never the host clock's local zone.
 */
const { DateTime } = require('luxon');
import type { DateTime as LuxonDateTime } from 'luxon';

const IST_ZONE = 'Asia/Kolkata';

function nowIST(): LuxonDateTime { return DateTime.now().setZone(IST_ZONE); }

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesOfDay(dt: LuxonDateTime): number { return dt.hour * 60 + dt.minute; }

function isAtOrAfter(hhmm: string, dt: LuxonDateTime = nowIST()): boolean {
  return minutesOfDay(dt) >= hhmmToMinutes(hhmm);
}

function tradingDateIST(dt: LuxonDateTime = nowIST()): string { return dt.toISODate()!; }

function nextWeeklyExpiry(expiryWeekday: number, rollAfter: string, dt: LuxonDateTime = nowIST()): string {
  let daysAhead = (expiryWeekday - dt.weekday + 7) % 7;
  if (daysAhead === 0 && isAtOrAfter(rollAfter, dt)) daysAhead = 7;
  return dt.plus({ days: daysAhead }).toISODate()!;
}

export = { IST_ZONE, nowIST, isAtOrAfter, tradingDateIST, nextWeeklyExpiry, hhmmToMinutes };
