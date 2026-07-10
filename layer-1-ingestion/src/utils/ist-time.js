/**
 * IST-aware time helpers.
 *
 * Every trading-session concept (expiry roll, session cutoffs, daily counters)
 * MUST use these helpers — NEVER the host clock's `new Date()` directly.
 * A UTC container running local-time getDay()/getHours() is a latent 5:30 bug.
 */

/** Offset minutes from UTC to IST. Use a getter so test overrides work. */
function istOffsetMinutes() {
  return Number(process.env.IST_OFFSET_MINUTES) || 330; // +5:30 default
}

/**
 * Return a Date representing the current IST time.
 * In production IST_OFFSET_MINUTES is 330; in tests it may be overridden.
 */
function nowIST() {
  const offsetMs = istOffsetMinutes() * 60 * 1000;
  return new Date(Date.now() + offsetMs);
}

/**
 * Build a Date at the start of the given IST day (midnight IST).
 */
function startOfDayIST(year, month, day) {
  const offsetMs = istOffsetMinutes() * 60 * 1000;
  // Create in UTC then subtract offset so that the Date's UTC epoch
  // corresponds to IST midnight.
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - offsetMs);
}

/**
 * ISO weekday (1=Mon .. 7=Sun) for each underlying's weekly expiry.
 *
 * ⚠️ DO NOT hardcode a weekday here. This file previously asserted "NIFTY expires every
 * Thursday" while `layer-10-execution/config/default.js` used Tuesday — two files, two
 * answers, one confidently wrong. The value is declared ONCE in `shared/constants.js`
 * (`EXPIRY_WEEKDAY_ISO`) and overridable per environment, and the owner must verify it
 * against the current NSE circular before live trading.
 *
 * Numbering trap: JS `getDay()` is 0=Sun..6=Sat; ISO is 1=Mon..7=Sun. They coincide for
 * Mon–Sat and differ only on Sunday — which is why a mismatch survives review.
 */
const DEFAULT_EXPIRY_WEEKDAY_ISO = {
  NIFTY: Number(process.env.NIFTY_EXPIRY_WEEKDAY_ISO) || 2,
  BANKNIFTY: Number(process.env.BANKNIFTY_EXPIRY_WEEKDAY_ISO) || 2,
};

/** ISO (1=Mon..7=Sun) -> JS getDay() (0=Sun..6=Sat) */
const isoToJsDay = (iso) => iso % 7;

/**
 * Compute the next weekly expiry for an index, in IST.
 *
 * If today IS the expiry day and the cutoff hour (12:00 IST) has passed, roll to next week.
 *
 * @param {"NIFTY"|"BANKNIFTY"|string} [underlying="NIFTY"]
 * @param {{expiryWeekdayIso?: number, cutoffHour?: number}} [opts]
 * @returns {Date} A Date whose UTC epoch corresponds to 15:30 IST on the expiry date.
 * @throws if the resolved weekday is not a valid ISO weekday (fail closed, rule 11).
 */
function nextWeeklyExpiryIST(underlying, opts = {}) {
  const key = (underlying || 'NIFTY').toUpperCase();
  const expiryIso = opts.expiryWeekdayIso ?? DEFAULT_EXPIRY_WEEKDAY_ISO[key] ?? DEFAULT_EXPIRY_WEEKDAY_ISO.NIFTY;

  if (!Number.isInteger(expiryIso) || expiryIso < 1 || expiryIso > 7) {
    throw new Error(`nextWeeklyExpiryIST: invalid ISO expiry weekday ${expiryIso} for ${key} (expected 1..7)`);
  }

  const cutoffHour = opts.cutoffHour ?? 12;
  const expiryDay = isoToJsDay(expiryIso);

  const now = nowIST();
  const dow = now.getUTCDay(); // day-of-week in IST terms (nowIST is already shifted)
  const hours = now.getUTCHours();

  let daysUntil = (expiryDay - dow + 7) % 7;
  if (daysUntil === 0 && hours >= cutoffHour) daysUntil = 7; // roll after cutoff

  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + daysUntil);
  expiry.setUTCHours(15, 30, 0, 0); // 15:30 IST in the shifted frame

  const offsetMs = istOffsetMinutes() * 60 * 1000;
  return new Date(expiry.getTime() - offsetMs);
}

module.exports = {
  nowIST,
  startOfDayIST,
  nextWeeklyExpiryIST,
  istOffsetMinutes,
  isoToJsDay,
  DEFAULT_EXPIRY_WEEKDAY_ISO,
};
