function PositionalScreen() {
  const { DailyRiskCard, Badge, Card, StatTile } = window.AutoTrading_f56db4;
  const { positions } = window.MOCK;
  const totalTheta = positions.reduce((s, p) => s + p.theta * p.lots, 0);
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0);
  const netDelta = positions.reduce((s, p) => s + p.delta * p.lots, 0);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="layers" style={{ color: 'var(--color-accent)' }}></i>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>Positional — Option Selling</h1>
      </div>

      {/* Book-level greeks */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <StatTile label="Net P&L" value={`₹${totalPnl.toLocaleString('en-IN')}`} tone={totalPnl >= 0 ? 'positive' : 'negative'} />
        <StatTile label="Theta / day" value={`₹${Math.round(totalTheta).toLocaleString('en-IN')}`} tone="positive" footnote="Decay works for a seller" />
        <StatTile label="Net Delta" value={netDelta.toFixed(2)} tone={Math.abs(netDelta) > 1 ? 'warning' : 'neutral'} />
      </div>

      <DailyRiskCard dailyLoss={4200} maxDailyLoss={10000} tradesToday={4} maxTrades={10} />

      {/* Position cards with Greeks — card layout reads better than a dense table on mobile */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {positions.map((p) => {
          const ageMin = Math.round((Date.now() - p.entryTime) / 60000);
          return (
            <Card key={p.id} padding="sm">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{p.symbol}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Sold {p.lots} lot{p.lots > 1 ? 's' : ''} · {ageMin}m ago</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'var(--font-weight-bold)', fontVariantNumeric: 'tabular-nums', color: p.pnl >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{p.pnl >= 0 ? '+' : ''}₹{p.pnl}</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{p.pnlPct >= 0 ? '+' : ''}{p.pnlPct}%</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 'var(--text-xs)' }}>
                <Greek label="IV" value={`${p.iv}%`} />
                <Greek label="Theta" value={p.theta} accent="var(--color-success)" />
                <Greek label="Delta" value={p.delta} />
                <Greek label="Stop" value={p.stopLoss ? `₹${p.stopLoss}` : 'NO STOP'} accent={p.stopLoss ? undefined : 'var(--color-error)'} bold={!p.stopLoss} />
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Greek({ label, value, accent, bold }) {
  return (
    <div>
      <div style={{ color: 'var(--color-text-tertiary)' }}>{label}</div>
      <div style={{ color: accent || 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums', fontWeight: bold ? 'var(--font-weight-bold)' : undefined }}>{value}</div>
    </div>
  );
}

window.PositionalScreen = PositionalScreen;
