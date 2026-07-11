// @ts-nocheck
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import type { StrategyConfig } from '@/shared/types';

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<StrategyConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/v1/strategies').then(r => r.json()).then(d => {
      if (d.success) setStrategies(d.data);
      setLoading(false);
    });
  }, []);

  const toggle = async (s: StrategyConfig) => {
    await fetch(`/api/v1/strategies/${s.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    setStrategies(prev => prev.map(p => p.id === s.id ? { ...p, enabled: !p.enabled } : p));
  };

  if (loading) return <AppShell><div className="p-8 text-text-tertiary">Loading...</div></AppShell>;

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Strategies</h1>
        <span className="text-sm text-text-tertiary">Pluggable · enable / disable / tune without redeploy</span>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
        {strategies.map(s => (
          <div key={s.id} className="card hoverable">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">{s.name}</h2>
              <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ${s.enabled ? 'badge-ok' : 'badge-err'}`}>{s.enabled ? 'LIVE' : 'SHADOW'}</span>
            </div>
            <div className="text-xs text-text-tertiary mb-2">{s.tier} · {s.description}</div>
            <div className="flex gap-4 flex-wrap mb-2">
              <div><div className="text-[11px] text-text-tertiary">Win rate</div><div className="tabular-nums font-bold">47%</div></div>
              <div><div className="text-[11px] text-text-tertiary">Expectancy</div><div className="tabular-nums text-success font-bold">+0.34R</div></div>
              <div><div className="text-[11px] text-text-tertiary">Profit factor</div><div className="tabular-nums font-bold">1.42</div></div>
            </div>
            <svg className="w-full h-10" viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true">
              <polyline fill="none" stroke="var(--color-success)" strokeWidth="2" points="0,34 40,30 80,32 120,24 160,20 200,22 240,12 300,6" />
            </svg>
            {s.params && (
              <div className="grid grid-cols-3 gap-1.5 mt-3 pt-3 border-t border-border">
                {Object.entries(s.params).slice(0, 6).map(([k, v]) => (
                  <div key={k} className="text-[11px]"><span className="text-text-tertiary">{k.replace(/([A-Z])/g, ' $1').trim()}</span><span className="text-text-primary tabular-nums ml-1 font-semibold">{typeof v === 'number' ? (v as number).toFixed(2) : String(v)}</span></div>
                ))}
              </div>
            )}
            <button onClick={() => toggle(s)} className={`mt-3 px-4 py-1.5 text-xs rounded-lg font-medium transition w-full ${s.enabled ? 'bg-error/15 text-error hover:bg-error/25' : 'bg-success/15 text-success hover:bg-success/25'}`}>{s.enabled ? 'Disable' : 'Enable'}</button>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
