function StrategiesScreen() {
  const { Card, Badge, Button } = window.AutoTrading_f56db4;
  const [strategies, setStrategies] = React.useState([
    { id: 1, name: 'ORB-15', tier: 'Tier 1', description: 'Opening range breakout', enabled: true, winRate: 61 },
    { id: 2, name: 'VWAP-Reject', tier: 'Tier 1', description: 'Fade VWAP rejection', enabled: true, winRate: 54 },
    { id: 3, name: 'Momentum', tier: 'Tier 2', description: 'RSI + volume momentum', enabled: false, winRate: 47 },
  ]);
  const toggle = (id) => setStrategies((s) => s.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x)));

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="target" style={{ color: 'var(--color-primary)' }}></i>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>Strategy Registry</h1>
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>Enable, disable, and tune strategies. Changes apply at runtime.</p>
      {strategies.map((s) => (
        <Card key={s.id} padding="sm">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>{s.name}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>{s.tier} · {s.description}</div>
            </div>
            <Button size="sm" variant={s.enabled ? 'secondary' : 'primary'} onClick={() => toggle(s.id)}>{s.enabled ? 'Enabled' : 'Disabled'}</Button>
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
            Win rate: <span style={{ color: 'var(--color-text-primary)' }}>{s.winRate}%</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
window.StrategiesScreen = StrategiesScreen;

function RiskConfigScreen() {
  const { Card, Input, Button } = window.AutoTrading_f56db4;
  const [cfg, setCfg] = React.useState({ maxLots: 10, maxConcurrent: 3, maxTradesPerDay: 15, maxDailyLoss: 10000, maxRiskPerTradePct: 1.5 });
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="shield" style={{ color: 'var(--color-warning)' }}></i>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>Risk Configuration</h1>
      </div>
      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Input label="Max Lots" type="number" value={cfg.maxLots} onChange={(e) => set('maxLots', e.target.value)} />
          <Input label="Max Concurrent" type="number" value={cfg.maxConcurrent} onChange={(e) => set('maxConcurrent', e.target.value)} />
          <Input label="Max Trades/Day" type="number" value={cfg.maxTradesPerDay} onChange={(e) => set('maxTradesPerDay', e.target.value)} />
          <Input label="Daily Loss Limit (₹)" type="number" value={cfg.maxDailyLoss} onChange={(e) => set('maxDailyLoss', e.target.value)} />
          <Input label="Risk Per Trade %" type="number" value={cfg.maxRiskPerTradePct} onChange={(e) => set('maxRiskPerTradePct', e.target.value)} />
        </div>
        <div style={{ marginTop: 16 }}><Button variant="primary">Save</Button></div>
      </Card>
    </div>
  );
}
window.RiskConfigScreen = RiskConfigScreen;
