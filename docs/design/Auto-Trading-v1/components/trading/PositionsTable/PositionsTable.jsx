import React from 'react';

/** PositionsTable — open-position book. Numeric cols tabular; SL shown loudly when missing. */
export function PositionsTable({ positions = [], style, ...props }) {
  if (positions.length === 0) {
    return <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>No open positions.</div>;
  }
  const cell = { padding: '10px 12px', fontSize: 'var(--text-sm)' };
  return (
    <div style={{ overflowX: 'auto', fontFamily: 'var(--font-sans)', ...style }} {...props}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)', borderBottom: '1px solid var(--color-border)' }}>
            <th style={cell}>Contract</th><th style={cell}>Size</th><th style={{ ...cell, textAlign: 'right' }}>LTP</th><th style={cell}>Stop</th><th style={{ ...cell, textAlign: 'right' }}>P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const hasStop = Number.isFinite(p.stopLoss) && p.stopLoss > 0;
            const up = p.pnl > 0, down = p.pnl < 0;
            return (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                <td style={cell}>
                  <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{p.symbol}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: p.optionType === 'CE' ? 'var(--color-success)' : 'var(--color-error)' }}>{p.optionType}</div>
                </td>
                <td style={{ ...cell, color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{p.lots} lot{p.lots === 1 ? '' : 's'}</td>
                <td style={{ ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>{p.currentPrice}</td>
                <td style={cell}>{hasStop ? <span style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>{p.stopLoss}</span> : <span style={{ color: 'var(--color-error)', fontWeight: 'var(--font-weight-bold)' }}>NO STOP</span>}</td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 'var(--font-weight-semibold)', fontVariantNumeric: 'tabular-nums', color: up ? 'var(--color-success)' : down ? 'var(--color-error)' : 'var(--color-text-secondary)' }}>{p.pnl > 0 ? '+' : ''}{p.pnl}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
