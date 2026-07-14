function ScalpScreen() {
  window.useLiveTick();
  const { SafetyBar, TradeModeBadge, StaleBadge, KillSwitchButton, OptionChainGrid, Badge, Card } = window.AutoTrading_f56db4;
  const [underlying, setUnderlying] = React.useState('NIFTY');
  const [timeframe, setTimeframe] = React.useState('1m');
  const [direction, setDirection] = React.useState('LONG');
  const [halted, setHalted] = React.useState(false);
  const spot = underlying === 'NIFTY' ? window.MOCK.niftySeries.at(-1) : window.MOCK.bankniftySeries.at(-1);
  const series = underlying === 'NIFTY' ? window.MOCK.niftySeries : window.MOCK.bankniftySeries;
  const rows = React.useMemo(() => window.MOCK.chainRows(spot), [underlying]);
  const atm = Math.round(spot / 50) * 50;

  const intent = {
    nfoSymbol: `${underlying}${atm}${direction === 'LONG' ? 'CE' : 'PE'}`,
    premium: direction === 'LONG' ? 128.4 : 64.1,
    lots: 2, lotSize: underlying === 'NIFTY' ? 25 : 15,
    sl: direction === 'LONG' ? 95 : 82,
    target: direction === 'LONG' ? 172 : 40,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <SafetyBar
        underlying={underlying}
        spot={spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        tradeModeBadge={<TradeModeBadge mode="live" />}
        staleBadge={<StaleBadge timestamp={new Date().toISOString()} />}
        killSwitchButton={<KillSwitchButton active={halted} onToggle={() => setHalted((h) => !h)} />}
      />

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 100 }}>
        {/* Underlying + timeframe */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {['NIFTY', 'BANKNIFTY'].map((u) => (
            <button key={u} onClick={() => setUnderlying(u)} style={pill(u === underlying)}>{u}</button>
          ))}
          <div style={{ flex: 1 }} />
          {['1m', '5m', '15m', '1h'].map((tf) => (
            <button key={tf} onClick={() => setTimeframe(tf)} style={pill(tf === timeframe, true)}>{tf}</button>
          ))}
        </div>

        {/* Chart */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 12 }}>
          <MiniChart data={series} height={140} color="var(--color-primary)" />
        </div>

        {/* Day P&L strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 12 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Day P&amp;L</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)', fontVariantNumeric: 'tabular-nums' }}>+₹1,100</div>
          </div>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 12 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>Session</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-warning)', fontFamily: 'var(--font-mono)' }}>E: 00:24 · S: 00:39</div>
          </div>
        </div>

        {/* Option chain */}
        <div style={{ maxHeight: '46vh', overflowY: 'auto', borderRadius: 'var(--radius-xl)' }}>
          <OptionChainGrid rows={rows} spot={spot.toFixed(2)} atm={atm} expiry="25 Jul (0d, weekly)" />
        </div>

        {/* Engine intent */}
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-xl)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--font-weight-semibold)' }}>Engine Intent</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['LONG', 'SHORT'].map((d) => (
                <button key={d} onClick={() => setDirection(d)} style={pill(d === direction, false, d === 'LONG' ? 'var(--color-success)' : 'var(--color-error)')}>{d}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 'var(--text-xs)' }}>
            <Row label="Contract" value={intent.nfoSymbol} mono />
            <Row label="Premium" value={intent.premium.toFixed(2)} />
            <Row label="Lots" value={`${intent.lots} × ${intent.lotSize}`} />
            <Row label="Stop / Target" value={<><span style={{ color: 'var(--color-error)' }}>{intent.sl}</span> / <span style={{ color: 'var(--color-success)' }}>{intent.target}</span></>} />
          </div>
        </div>
      </div>

      {/* Sticky quick-execute ticket */}
      <div style={{ position: 'sticky', bottom: 0, display: 'flex', gap: 10, padding: 12, background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)' }}>
        <button style={{ ...actionBtn, background: 'var(--color-success)' }}>BUY CE</button>
        <button style={{ ...actionBtn, background: 'var(--color-error)' }}>BUY PE</button>
        <button style={{ ...actionBtn, background: 'var(--color-text-tertiary)', flex: '0 0 auto', width: 56 }}><i data-lucide="square" style={{ color: '#fff' }}></i></button>
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--color-text-tertiary)' }}>{label}</span>
      <span style={{ color: 'var(--color-text-primary)', fontFamily: mono ? 'var(--font-mono)' : undefined }}>{value}</span>
    </div>
  );
}

function pill(active, small, activeColor) {
  return {
    padding: small ? '4px 10px' : '6px 12px',
    fontSize: 'var(--text-xs)',
    borderRadius: 'var(--radius-md)',
    border: active ? 'none' : '1px solid var(--color-border)',
    background: active ? (activeColor || 'var(--color-primary)') : 'var(--color-surface)',
    color: active ? '#fff' : 'var(--color-text-tertiary)',
    cursor: 'pointer',
    fontWeight: 'var(--font-weight-medium)',
  };
}

const actionBtn = {
  flex: 1, padding: '14px 0', border: 'none', borderRadius: 'var(--radius-lg)',
  color: '#fff', fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

window.ScalpScreen = ScalpScreen;
