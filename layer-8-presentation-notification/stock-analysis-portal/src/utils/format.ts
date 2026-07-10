const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const EMPTY = '\u2014'; // em dash

export function formatTime(timestamp: string | number | null | undefined): string {
  if (!timestamp) return 'N/A';
  try {
    let dateObj: Date;
    if (typeof timestamp === 'string') {
      dateObj = new Date(timestamp.replace(/(\.\d{3})\d+/, '$1'));
    } else {
      dateObj = new Date(timestamp);
    }
    if (isNaN(dateObj.getTime())) return String(timestamp);
    return dateObj.toLocaleTimeString();
  } catch {
    return String(timestamp);
  }
}

export function formatDate(timestamp: string | number | null | undefined): string {
  if (!timestamp) return 'N/A';
  try {
    let dateObj: Date;
    if (typeof timestamp === 'string') {
      dateObj = new Date(timestamp.replace(/(\.\d{3})\d+/, '$1'));
    } else {
      dateObj = new Date(timestamp);
    }
    if (isNaN(dateObj.getTime())) return String(timestamp);
    return dateObj.toLocaleDateString();
  } catch {
    return String(timestamp);
  }
}

interface FormatOpts {
  decimals?: number;
}

export function formatCurrency(value: unknown, { decimals = 2 }: FormatOpts = {}): string {
  if (!isNum(value)) return EMPTY;
  return `\u20B9${value.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatSignedCurrency(value: unknown, opts?: FormatOpts): string {
  if (!isNum(value)) return EMPTY;
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : '';
  return `${sign}${formatCurrency(Math.abs(value), opts)}`;
}

export function formatSignedPct(value: unknown, { decimals = 2 }: FormatOpts = {}): string {
  if (!isNum(value)) return EMPTY;
  const sign = value > 0 ? '+' : value < 0 ? '\u2212' : '';
  return `${sign}${Math.abs(value).toFixed(decimals)}%`;
}

export function formatPct(value: unknown, { decimals = 1 }: FormatOpts = {}): string {
  return isNum(value) ? `${value.toFixed(decimals)}%` : EMPTY;
}

export function formatNumber(value: unknown): string {
  return isNum(value) ? value.toLocaleString('en-IN') : EMPTY;
}

export function formatLots(lots: unknown, lotSize: unknown): string {
  if (!isNum(lots)) return EMPTY;
  if (!isNum(lotSize)) return `${lots} lot${lots === 1 ? '' : 's'}`;
  return `${lots} lot${lots === 1 ? '' : 's'} (${formatNumber(lots * lotSize)} qty)`;
}

export type PnLDirection = 'up' | 'down' | 'flat' | null;

export function pnlDirection(value: unknown): PnLDirection {
  if (!isNum(value)) return null;
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}

export function secondsSince(timestamp: string | null | undefined): number | null {
  if (!timestamp) return null;
  const t = new Date(timestamp).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 1000));
}

export function timeAgo(timestamp: string | null | undefined): string {
  const s = secondsSince(timestamp);
  if (s === null) return EMPTY;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export function minutesSince(timestamp: string | null | undefined): number | null {
  const s = secondsSince(timestamp);
  return s === null ? null : Math.floor(s / 60);
}
