function BackfillScreen() {
  const { Button, Card, Badge } = window.AutoTrading_f56db4;
  const { backfillSymbols } = window.MOCK;
  const [running, setRunning] = React.useState(true);
  const [progress, setProgress] = React.useState(62);

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setProgress((p) => (p >= 100 ? 100 : p + 1)), 400);
    return () => clearInterval(t);
  }, [running]);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 88 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <i data-lucide="database" style={{ color: 'var(--color-info)' }}></i>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>Backfill Data</h1>
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-tertiary)', margin: 0 }}>
        Pull historical candles into the database for symbols the strategies need. Safe to re-run — existing candles are skipped.
      </p>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>Nifty 50 · 1m candles</span>
          <Badge variant={progress >= 100 ? 'success' : 'info'} size="sm">{progress >= 100 ? 'Completed' : 'Running'}</Badge>
        </div>
        <div style={{ height: 8, borderRadius: 'var(--radius-full)', background: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary)', transition: 'width 0.4s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 8 }}>
          <span>{progress}% · {backfillSymbols.length} symbols</span>
          <span>ETA {Math.max(0, Math.round((100 - progress) / 5))}m</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button variant={running ? 'secondary' : 'primary'} size="sm" onClick={() => setRunning((r) => !r)}>{running ? 'Pause' : 'Resume'}</Button>
          <Button variant="ghost" size="sm" onClick={() => setProgress(0)}>Restart</Button>
        </div>
      </Card>

      <Card padding="none">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontWeight: 'var(--font-weight-semibold)' }}>Symbol status</div>
        <div>
          {backfillSymbols.map((s, i) => {
            const done = (i / backfillSymbols.length) * 100 < progress;
            return (
              <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: i < backfillSymbols.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>{s}</span>
                {done ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-success)', fontSize: 'var(--text-xs)' }}><i data-lucide="check-circle-2"></i>Backfilled</span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-tertiary)', fontSize: 'var(--text-xs)' }}><i data-lucide="loader-2" style={{ animation: 'spin 1s linear infinite' }}></i>Queued</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
window.BackfillScreen = BackfillScreen;
