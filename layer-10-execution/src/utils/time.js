/**
 * IST time helpers.
 * All trading-session logic (entry cutoff, square-off, expiry roll)
 * must use these, never the host clock's local zone.
 */
const { DateTime } = require('luxon');

const IST_ZONE = 'Asia/Kolkata';

function nowIST() {
  return DateTime.now().setZone(IST_ZONE);
}

/** 'HH:mm' -> minutes since midnight */
function hhmmToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function minutesOfDay(dt) {
  return dt.hour * 60 + dt.minute;
}

/** Is `dt` (default: now IST) at or past the 'HH:mm' wall-clock time? */
function isAtOrAfter(hhmm, dt = nowIST()) {
  return minutesOfDay(dt) >= hhmmToMinutes(hhmm);
}

/** Trading date key used for daily risk counters, e.g. '2026-07-04' */
function tradingDateIST(dt = nowIST()) {
  return dt.toISODate();
}

/**
 * Next weekly expiry date (ISO) for the given ISO weekday (1=Mon .. 7=Sun).
 * If today IS expiry day and we're past `rollAfter` ('HH:mm'), roll to next
 * week — theta decay on expiry-day afternoon is brutal for long scalps.
 */
function nextWeeklyExpiry(expiryWeekday, rollAfter, dt = nowIST()) {
  let daysAhead = (expiryWeekday - dt.weekday + 7) % 7;
  if (daysAhead === 0 && isAtOrAfter(rollAfter, dt)) {
    daysAhead = 7;
  }
  return dt.plus({ days: daysAhead }).toISODate();
}

module.exports = { IST_ZONE, nowIST, isAtOrAfter, tradingDateIST, nextWeeklyExpiry, hhmmToMinutes };
