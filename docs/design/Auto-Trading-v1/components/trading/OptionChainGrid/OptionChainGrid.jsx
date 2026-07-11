import React from 'react';

function fmt(n, d = 2) { return n != null ? Number(n).toFixed(d) : '—'; }
function spreadPct(ask, bid) { return (ask && bid && ask > 0) ? ((ask - bid) / ask * 100).toFixed(1) + '%' : '—'; }

/** OptionChainGrid — CALLS | STRIKE | PUTS ladder, ATM row highlighted, spreads colored by width. */
export function OptionChainGrid({ rows = [], spot, atm, expiry, style, ...props }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', fontFamily: 'var(--font-sans)', ...style }} {...props}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>Option Chain</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Spot: <span style={{ color: 'var(--color-text-primary)' }}>{spot ?? '—'}</span></span>
        </div>
        {expiry && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{expiry}</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: 'var(--text-xs)', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-tertiary)' }}>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>LTP</th>
              <th style={{ padding: '4px 6px', textAlign: 'right' }}>OI</th>
              <th style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}>STRIKE</th>
              <th style={{ padding: '4px 6px', textAlign: 'left' }}>OI</th>
              <th style={{ padding: '4px 6px', textAlign: 'left' }}>LTP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.strike || i} style={{ borderBottom: '1px solid var(--color-border)', background: r.strike === atm ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : undefined }}>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.ce ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{r.ce ? fmt(r.ce.ltp) : '—'}</td>
                <td style={{ padding: '4px 6px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{r.ce ? r.ce.oi?.toLocaleString() : '—'}</td>
                <td style={{ padding: '4px 6px', textAlign: 'center', borderRight: '1px solid var(--color-border)', borderLeft: '1px solid var(--color-border)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: r.strike === atm ? 'var(--color-warning)' : 'var(--color-text-primary)', fontWeight: r.strike === atm ? 'var(--font-weight-bold)' : undefined }}>{r.strike}</td>
                <td style={{ padding: '4px 6px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>{r.pe ? r.pe.oi?.toLocaleString() : '—'}</td>
                <td style={{ padding: '4px 6px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', color: r.pe ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>{r.pe ? fmt(r.pe.ltp) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No option chain data.</div>}
      </div>
    </div>
  );
}
