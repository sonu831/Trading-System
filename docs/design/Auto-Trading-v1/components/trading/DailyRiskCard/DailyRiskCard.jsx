import React from 'react';
import { RiskMeter } from '../../data/RiskMeter/RiskMeter';

/** DailyRiskCard — daily risk envelope: loss vs circuit breaker + trades-today meters. */
export function DailyRiskCard({ dailyLoss, maxDailyLoss, tradesToday, maxTrades, halted, style, ...props }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 20, fontFamily: 'var(--font-sans)', ...style }} {...props}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>Daily risk envelope</h3>
        {halted && <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>HALTED</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <RiskMeter label="Daily loss vs circuit breaker" used={dailyLoss} limit={maxDailyLoss} formatValue={(v) => `₹${v.toLocaleString('en-IN')}`} invertWords={{ danger: 'Circuit breaker tripped — trading halted' }} />
        <RiskMeter label="Trades today" used={tradesToday} limit={maxTrades} />
      </div>
    </div>
  );
}
