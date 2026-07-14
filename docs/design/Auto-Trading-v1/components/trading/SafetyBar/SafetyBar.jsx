import React from 'react';

/** SafetyBar — sticky always-visible header: underlying + spot + trade mode + kill switch. */
export function SafetyBar({ underlying = 'NIFTY', spot, tradeModeBadge, killSwitchButton, staleBadge, style, ...props }) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', boxShadow: 'var(--shadow-lg)', fontFamily: 'var(--font-sans)', ...style }} {...props}>
      <span style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)', fontSize: 'var(--text-sm)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>{underlying}</span>
      <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{spot ?? '—'}</span>
      <div style={{ flex: 1 }} />
      {tradeModeBadge}
      {staleBadge}
      {killSwitchButton}
    </div>
  );
}
