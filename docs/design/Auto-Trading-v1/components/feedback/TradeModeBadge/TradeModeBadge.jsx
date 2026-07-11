import React from 'react';

const MODES = {
  paper: { label: 'PAPER', bg: 'var(--color-surface)', border: 'var(--color-border)', color: 'var(--color-text-secondary)' },
  shadow: { label: 'SHADOW', bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', border: 'color-mix(in srgb, var(--color-warning) 40%, transparent)', color: 'var(--color-warning)' },
  live: { label: 'LIVE', bg: 'color-mix(in srgb, var(--color-error) 15%, transparent)', border: 'var(--color-error)', color: 'var(--color-error)' },
  unknown: { label: 'MODE UNKNOWN', bg: 'var(--color-surface)', border: 'var(--color-border)', color: 'var(--color-text-tertiary)' },
};

/** TradeModeBadge — always-visible indicator of paper / shadow / live execution mode. */
export function TradeModeBadge({ mode, style, ...props }) {
  const key = mode && MODES[mode] ? mode : 'unknown';
  const m = MODES[key];
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '6px 12px', borderRadius: 'var(--radius-lg)',
        border: `1px solid ${m.border}`, background: m.bg, color: m.color,
        fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-bold)', letterSpacing: 'var(--tracking-wider)',
        fontFamily: 'var(--font-sans)',
        animation: key === 'live' ? 'auto-trading-pulse 1.6s ease-in-out infinite' : undefined,
        ...style,
      }}
      {...props}
    >
      {m.label}
      <style>{`@keyframes auto-trading-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }`}</style>
    </span>
  );
}
