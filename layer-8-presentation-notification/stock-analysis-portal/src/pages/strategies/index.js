import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/strategies').then(r => r.json()).then(d => {
      if (d.success) setStrategies(d.data);
      setLoading(false);
    });
  }, []);

  const toggle = async (s) => {
    await fetch(`/api/v1/strategies/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    setStrategies(prev => prev.map(p => p.id === s.id ? { ...p, enabled: !p.enabled } : p));
  };

  if (loading) return <AppLayout><div className="p-8 text-text-tertiary">Loading...</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Strategy Registry</h1>
        <p className="text-text-tertiary text-sm mb-6">Enable, disable, and tune trading strategies. Changes apply at runtime.</p>

        <div className="grid gap-4">
          {strategies.map(s => (
            <div key={s.id} className="bg-surface border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{s.name}</h2>
                  <p className="text-xs text-text-tertiary">{s.tier} · {s.description}</p>
                </div>
                <button onClick={() => toggle(s)}
                  className={`px-4 py-1.5 text-xs rounded-lg font-medium transition ${s.enabled ? 'bg-success/20 text-success hover:bg-success/30' : 'bg-border text-text-tertiary hover:bg-border/80'}`}>
                  {s.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              {s.params && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
                  {Object.entries(s.params).map(([k, v]) => (
                    <div key={k} className="text-xs">
                      <span className="text-text-tertiary block">{k.replace(/([A-Z])/g, ' $1')}</span>
                      <span className="text-text-primary font-mono">{typeof v === 'number' ? v.toFixed(2) : v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
