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
 * Compute the next weekly expiry for an index in IST.
 *
 * NIFTY expires every Thursday; BANKNIFTY expires every Wednesday.
 * If today IS the expiry day and the cutoff hour (12:00 IST) has passed,
 * the expiry rolls forward to the following week.
 *
 * @param {"NIFTY"|"BANKNIFTY"} [underlying="NIFTY"]
 * @returns {Date}  A Date whose UTC value represents the expiry date at IST 15:30.
 */
function nextWeeklyExpiryIST(underlying) {
  underlying = (underlying || 'NIFTY').toUpperCase();
  const expiryDay = underlying === 'BANKNIFTY' ? 3 : 4; // Wed=3, Thu=4
  const cutoffHour = 12;

  const now = nowIST();
  const dow = now.getUTCDay(); // day-of-week in IST terms (because nowIST already shifted)
  const hours = now.getUTCHours();

  // Days until next expiry day
  let daysUntil = (expiryDay - dow + 7) % 7;
  if (daysUntil === 0 && hours >= cutoffHour) {
    daysUntil = 7; // roll to next week after cutoff
  }

  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + daysUntil);
  // Set to end-of-expiry-time (15:30 IST → 10:00 UTC)
  expiry.setUTCHours(15, 30, 0, 0);
  // Adjust back by offset so the UTC epoch matches the intended IST wall-clock
  const offsetMs = istOffsetMinutes() * 60 * 1000;
  return new Date(expiry.getTime() - offsetMs);
}

module.exports = { nowIST, startOfDayIST, nextWeeklyExpiryIST, istOffsetMinutes };
