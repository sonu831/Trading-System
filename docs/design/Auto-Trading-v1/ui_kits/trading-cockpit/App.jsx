function App() {
  const [tab, setTab] = React.useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', Screen: window.DashboardScreen },
    { id: 'scalp', label: 'Scalp', icon: 'zap', Screen: window.ScalpScreen },
    { id: 'positional', label: 'Positional', icon: 'layers', Screen: window.PositionalScreen },
    { id: 'backfill', label: 'Backfill', icon: 'database', Screen: window.BackfillScreen },
    { id: 'brokers', label: 'Brokers', icon: 'key', Screen: window.BrokersScreen },
    { id: 'strategies', label: 'Strategies', icon: 'target', Screen: window.StrategiesScreen },
    { id: 'risk', label: 'Risk', icon: 'shield', Screen: window.RiskConfigScreen },
  ];
  const Active = tabs.find((t) => t.id === tab).Screen;

  React.useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  }, [tab]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-background)', position: 'relative' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Active />
      </div>

      {/* Bottom tab nav — mobile-first */}
      <nav style={{ position: 'sticky', bottom: 0, display: 'flex', background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', boxShadow: 'var(--shadow-2xl)' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: '10px 0 8px', color: tab === t.id ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <i data-lucide={t.icon}></i>
            <span style={{ fontSize: 11, fontWeight: tab === t.id ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)' }}>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
setTimeout(() => window.lucide && window.lucide.createIcons(), 50);
