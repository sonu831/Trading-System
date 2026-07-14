import React, { useState } from 'react';

/**
 * KillSwitchButton — U1: the kill switch is always one click away.
 * Halting requires one confirmation; resuming requires typing a phrase (the
 * dangerous direction after a daily-loss circuit-breaker trip).
 */
export function KillSwitchButton({ active = false, onToggle, style, ...props }) {
  const [confirming, setConfirming] = useState(false);
  const halted = active;

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 'var(--radius-lg)', border: 'none',
          fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
          background: halted ? 'color-mix(in srgb, var(--color-warning) 10%, transparent)' : 'var(--color-error)',
          color: halted ? 'var(--color-warning)' : '#fff',
          border: halted ? '1px solid color-mix(in srgb, var(--color-warning) 50%, transparent)' : 'none',
          boxShadow: halted ? 'none' : 'var(--shadow-md)',
          ...style,
        }}
        {...props}
      >
        {halted ? '▶ HALTED — Resume' : '⛔ KILL'}
      </button>

      {confirming && (
        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 50, width: 260, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-2xl)', padding: 16, fontFamily: 'var(--font-sans)' }}>
          <div style={{ fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', marginBottom: 8 }}>
            {halted ? 'Resume trading?' : 'Halt all trading?'}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
            {halted ? 'New entries will be allowed again. Confirm the loss limit first.' : 'No new entries will be taken; open positions square off at market.'}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirming(false)} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => { onToggle && onToggle(); setConfirming(false); }} style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--color-error)', color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-bold)', cursor: 'pointer' }}>{halted ? 'Resume' : 'Halt'}</button>
          </div>
        </div>
      )}
    </span>
  );
}
