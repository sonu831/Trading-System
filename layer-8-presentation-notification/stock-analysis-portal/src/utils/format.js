export const formatTime = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    // Check if timestamp is a string and handle nanosecond precision
    // (e.g., "2026-01-18T17:29:14.679160385Z")
    let dateObj;
    if (typeof timestamp === 'string') {
      const timeStr = timestamp.replace(/(\.\d{3})\d+/, '$1');
      dateObj = new Date(timeStr);
    } else {
      dateObj = new Date(timestamp);
    }

    // Check for invalid date
    if (isNaN(dateObj.getTime())) return String(timestamp);

    return dateObj.toLocaleTimeString();
  } catch (e) {
    console.error('Error formatting time:', e);
    return String(timestamp);
  }
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'N/A';
  try {
    let dateObj;
    if (typeof timestamp === 'string') {
      const timeStr = timestamp.replace(/(\.\d{3})\d+/, '$1');
      dateObj = new Date(timeStr);
    } else {
      dateObj = new Date(timestamp);
    }

    if (isNaN(dateObj.getTime())) return String(timestamp);

    return dateObj.toLocaleDateString();
  } catch (e) {
    return String(timestamp);
  }
};

/* ------------------------------------------------------------------ *
 * Trading formatters
 *
 * Rule: never render a confident `0` for a value we do not have.
 * An unknown number is an em-dash. A real zero is "0".
 * (The pre-audit engine reported Rs.0 P&L on every trade — a UI that
 *  showed a confident 0 would have hidden that bug for weeks.)
 * ------------------------------------------------------------------ */

export const EMPTY = '—'; // em dash

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/** Rs. 1,234.50 — no sign. Returns EMPTY when the value is unknown. */
export const formatCurrency = (value, { decimals = 2 } = {}) => {
  if (!isNum(value)) return EMPTY;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
};

/** +Rs.1,234.50 / -Rs.980.00 — sign is explicit so colour is never the only cue. */
export const formatSignedCurrency = (value, opts) => {
  if (!isNum(value)) return EMPTY;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${formatCurrency(Math.abs(value), opts)}`;
};

/** +12.34% / -5.00% */
export const formatSignedPct = (value, { decimals = 2 } = {}) => {
  if (!isNum(value)) return EMPTY;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
};

export const formatPct = (value, { decimals = 1 } = {}) =>
  isNum(value) ? `${value.toFixed(decimals)}%` : EMPTY;

export const formatNumber = (value) => (isNum(value) ? value.toLocaleString('en-IN') : EMPTY);

/** "3 lots (225 qty)" — quantity is never mistaken for premium. */
export const formatLots = (lots, lotSize) => {
  if (!isNum(lots)) return EMPTY;
  if (!isNum(lotSize)) return `${lots} lot${lots === 1 ? '' : 's'}`;
  return `${lots} lot${lots === 1 ? '' : 's'} (${formatNumber(lots * lotSize)} qty)`;
};

/** Direction of P&L: 'up' | 'down' | 'flat' | null (unknown) */
export const pnlDirection = (value) => {
  if (!isNum(value)) return null;
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
};

/** Seconds since an ISO timestamp; null when unparseable. */
export const secondsSince = (timestamp) => {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
};

/** "4s ago" / "2m ago" / "1h ago" */
export const timeAgo = (timestamp) => {
  const s = secondsSince(timestamp);
  if (s === null) return EMPTY;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

/** Minutes a position has been open. */
export const minutesSince = (timestamp) => {
  const s = secondsSince(timestamp);
  return s === null ? null : Math.floor(s / 60);
};
