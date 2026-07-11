import React from 'react';

function timeAgo(ts) {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function levelFor(ts, warnAfter = 30, staleAfter = 120) {
  if (!ts) return 'unknown';
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s >= staleAfter) return 'stale';
  if (s >= warnAfter) return 'warn';
  return 'fresh';
}

const dotColor = { fresh: 'var(--color-success)', warn: 'var(--color-warning)', stale: 'var(--color-error)', unknown: 'var(--color-text-tertiary)' };
const textColor = { fresh: 'var(--color-text-tertiary)', warn: 'var(--color-warning)', stale: 'var(--color-error)', unknown: 'var(--color-text-tertiary)' };

/**
 * StaleBadge — announces data freshness in words + color.
 * fresh (<30s) quiet · warn (>=30s) amber · stale (>=2min) red + explicit warning.
 */
export function StaleBadge({ timestamp, warnAfter, staleAfter, label, style, ...props }) {
  const level = levelFor(timestamp, warnAfter, staleAfter);
  const text = level === 'unknown' ? 'no data' : level === 'stale' ? `STALE — ${timeAgo(timestamp)} · do not trade on this` : `updated ${timeAgo(timestamp)}`;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', fontFamily: 'var(--font-sans)', color: textColor[level], fontWeight: level === 'stale' ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)', ...style }} {...props}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor[level] }} />
      {text}
    </span>
  );
}
