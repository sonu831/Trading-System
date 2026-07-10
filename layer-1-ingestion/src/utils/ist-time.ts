/**
 * IST-aware time helpers — NEVER use the host clock's `new Date()` directly.
 *
 * There used to be an `ist-time.js` twin beside this file. Node resolved the `.js`, so this
 * `.ts` — which carries the P0 expiry fix — was never executed. That twin hardcoded a
 * weekly expiry weekday of 4 while shared/constants.js declares 2. Two answers, one of them
 * confidently wrong, and the wrong one was the one that ran. The twin is gone;
 * `shared/tests/no-ts-js-twins.test.js` fails if any reappears.
 */
// shared/ lives at a different depth in Docker (mounted at /app/shared) than in the local
// checkout (repo-root/shared). Resolve the Docker mount first, fall back to the local path.
// This ONLY papers over a path difference — if neither resolves, we throw, never default.
function requireShared(mod: string): any {
  try { return require(`/app/shared/${mod}`); }
  catch { return require(`../../../shared/${mod}`); }
}
const { EXPIRY_WEEKDAY_ISO } = requireShared('constants');

/** Minutes east of UTC for IST (+05:30). */
function istOffsetMinutes(): number { return Number(process.env.IST_OFFSET_MINUTES) || 330; }

/** "Now", shifted so the UTC getters read as IST wall-clock. */
function nowIST(): Date { return new Date(Date.now() + istOffsetMinutes() * 60 * 1000); }

function tradingDateIST(): string {
  const d = nowIST();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * ISO weekday (1=Mon..7=Sun) -> JS `Date#getDay()` weekday (0=Sun..6=Sat).
 *
 * Only Sunday differs (7 vs 0); Mon-Sat coincide. That is exactly why a mismatch survives
 * casual review and then fires once, on a Sunday. Config is ISO; every getUTCDay()
 * comparison must pass through here.
 */
function isoToJsDay(isoWeekday: number): number { return isoWeekday % 7; }

/** Expiry-day cutoff (IST hour) after which we roll to the following week. */
const ROLL_AFTER_HOUR = 12;

/**
 * Next weekly expiry for `underlying`, as an absolute Date (15:30 IST on expiry day).
 *
 * The weekday comes from shared/constants.js (`EXPIRY_WEEKDAY_ISO`) — declared ONCE — and
 * may be overridden per call for backtests. An invalid weekday throws rather than silently
 * defaulting: a wrong expiry date silently prices the wrong option contract.
 */
function nextWeeklyExpiryIST(
  underlying: string,
  opts: { expiryWeekdayIso?: number } = {},
): Date {
  const key = (underlying || 'NIFTY').toUpperCase();
  const iso = opts.expiryWeekdayIso ?? EXPIRY_WEEKDAY_ISO[key] ?? EXPIRY_WEEKDAY_ISO.NIFTY;

  if (!Number.isInteger(iso) || iso < 1 || iso > 7) {
    throw new Error(`nextWeeklyExpiryIST: invalid ISO weekday ${JSON.stringify(iso)} (expected integer 1..7)`);
  }

  const now = nowIST();
  const targetJsDay = isoToJsDay(iso);
  let daysUntil = (targetJsDay - now.getUTCDay() + 7) % 7;
  if (daysUntil === 0 && now.getUTCHours() >= ROLL_AFTER_HOUR) daysUntil = 7;

  const expiry = new Date(now);
  expiry.setUTCDate(expiry.getUTCDate() + daysUntil);
  expiry.setUTCHours(15, 30, 0, 0); // 15:30 IST close, read through the shifted clock

  // Shift back out of the IST-shifted frame into a true absolute instant.
  return new Date(expiry.getTime() - istOffsetMinutes() * 60 * 1000);
}

module.exports = { istOffsetMinutes, nowIST, tradingDateIST, nextWeeklyExpiryIST, isoToJsDay };
