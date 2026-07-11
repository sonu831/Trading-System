function DashboardScreen() {
  window.useLiveTick();
  const { niftySeries, bankniftySeries, watchlist, signals } = window.MOCK;
  const { StatTile, Table, Badge, Card } = window.AutoTrading_f56db4;
  const niftyChg = (((niftySeries.at(-1) - niftySeries[0]) / niftySeries[0]) * 100).toFixed(2);
  const bnChg = (((bankniftySeries.at(-1) - bankniftySeries[0]) / bankniftySeries[0]) * 100).toFixed(2);
  const advances = watchlist.filter((w) => w.chg > 0).length;
  const declines = watchlist.length - advances;

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="activity" style={{ color: 'var(--color-primary)' }}></i>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>Market Dashboard</h1>
      </div>

      {/* Index tiles w/ sparkline */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {[{ label: 'NIFTY 50', series: niftySeries, chg: niftyChg }, { label: 'BANK NIFTY', series: bankniftySeries, chg: bnChg }].map((idx) => (
          <div key={idx.label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 12 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)' }}>{idx.label}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>{idx.series.at(-1).toFixed(2)}</span>
              <span style={{ fontSize: 'var(--text-xs)', color: idx.chg >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>{idx.chg >= 0 ? '+' : ''}{idx.chg}%</span>
            </div>
            <MiniChart data={idx.series} height={56} color={idx.chg >= 0 ? 'var(--color-success)' : 'var(--color-error)'} />
          </div>
        ))}
      </div>

      {/* Sentiment + A/D */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatTile label="Market Sentiment" value="Bullish" tone="positive" icon={<i data-lucide="trending-up" />} />
        <StatTile label="Advance / Decline" value={`${advances} / ${declines}`} tone={advances >= declines ? 'positive' : 'negative'} icon={<i data-lucide="bar-chart-2" />} />
      </div>

      {/* Watchlist */}
      <Card padding="none">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--font-weight-semibold)' }}>Watchlist</div>
        <Table>
          <Table.Header><Table.Row><Table.HeaderCell>Symbol</Table.HeaderCell><Table.HeaderCell style={{ textAlign: 'right' }}>LTP</Table.HeaderCell><Table.HeaderCell style={{ textAlign: 'right' }}>Chg%</Table.HeaderCell><Table.HeaderCell style={{ textAlign: 'center' }}>RSI</Table.HeaderCell></Table.Row></Table.Header>
          <Table.Body>
            {watchlist.map((w) => (
              <Table.Row key={w.symbol}>
                <Table.Cell style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{w.symbol}</Table.Cell>
                <Table.Cell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>₹{w.ltp.toFixed(2)}</Table.Cell>
                <Table.Cell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: w.chg >= 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 'var(--font-weight-semibold)' }}>{w.chg >= 0 ? '+' : ''}{w.chg}%</Table.Cell>
                <Table.Cell style={{ textAlign: 'center' }}><Badge size="sm" variant={w.rsi > 70 ? 'error' : w.rsi < 30 ? 'success' : 'default'}>{w.rsi}</Badge></Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>

      {/* Signals feed */}
      <Card padding="none">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--font-weight-semibold)' }}>Live Signals</div>
        <Table>
          <Table.Header><Table.Row><Table.HeaderCell>Time</Table.HeaderCell><Table.HeaderCell>Symbol</Table.HeaderCell><Table.HeaderCell>Action</Table.HeaderCell><Table.HeaderCell>Strategy</Table.HeaderCell></Table.Row></Table.Header>
          <Table.Body>
            {signals.map((s, i) => (
              <Table.Row key={i}>
                <Table.Cell style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-tertiary)' }}>{s.time}</Table.Cell>
                <Table.Cell style={{ fontWeight: 'var(--font-weight-medium)' }}>{s.symbol}</Table.Cell>
                <Table.Cell><Badge size="sm" variant={s.action === 'BUY' ? 'success' : 'error'}>{s.action}</Badge></Table.Cell>
                <Table.Cell style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}>{s.strategy}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </Card>
    </div>
  );
}
window.DashboardScreen = DashboardScreen;
