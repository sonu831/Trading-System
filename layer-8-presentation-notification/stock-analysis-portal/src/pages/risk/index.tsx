// @ts-nocheck
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';

interface RiskConfig { maxLots: number; maxConcurrent: number; maxTradesPerDay: number; maxDailyLoss: number; maxRiskPerTradePct: number; entryCutoff: string; squareOff: string; mode: string; [key: string]: unknown; }

export default function RiskPage() {
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => { fetch('/api/v1/risk/config').then(r => r.json()).then(d => { if (d.success) setConfig(d.data); }); }, []);

  const update = (key: string, value: unknown) => setConfig(prev => prev ? { ...prev, [key]: value } : null);
  const save = async () => { setSaving(true); await fetch('/api/v1/risk/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }); setSaving(false); };

  if (!config) return <AppShell><div className="p-8 text-text-tertiary">Loading...</div></AppShell>;

  const Field = ({ label, field, type = 'number' }: { label: string; field: string; type?: string }) => (
    <div><label className="text-sm text-text-tertiary block mb-1">{label}</label><input type={type} value={String(config[field] ?? '')} onChange={e => update(field, type === 'number' ? Number(e.target.value) : e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" /></div>
  );

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Risk</h1>
        <span className="text-sm text-text-tertiary">Envelope · circuit breakers · sizing</span>
      </div>

      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card"><h2 className="text-sm font-bold mb-2">Daily loss limit</h2><div className="text-[22px] font-extrabold tabular-nums">{config.maxDailyLoss ? `−₹${config.maxDailyLoss.toLocaleString()}` : '—'}</div><div className="text-xs text-text-tertiary mt-1">Trips the kill switch on breach.</div></div>
        <div className="card"><h2 className="text-sm font-bold mb-2">Max concurrent</h2><div className="text-[22px] font-extrabold tabular-nums">{config.maxConcurrent || '—'}</div><div className="text-xs text-text-tertiary mt-1">Trades/day cap: <b>{config.maxTradesPerDay || '—'}</b></div></div>
        <div className="card"><h2 className="text-sm font-bold mb-2">Sizing</h2><div className="text-[22px] font-extrabold tabular-nums">{config.maxLots || '—'} lots</div><div className="text-xs text-text-tertiary mt-1">Risk per trade: <b>{config.maxRiskPerTradePct || '—'}%</b></div></div>
      </div>

      <div className="bg-surface border border-border rounded-xl p-5 max-w-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-bold">Configuration</h2>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
          <Field label="Max Lots" field="maxLots" />
          <Field label="Max Concurrent" field="maxConcurrent" />
          <Field label="Max Trades/Day" field="maxTradesPerDay" />
          <Field label="Daily Loss Limit (₹)" field="maxDailyLoss" />
          <Field label="Risk Per Trade %" field="maxRiskPerTradePct" />
          <Field label="Trade Mode" field="mode" type="text" />
        </div>
        <div className="border-t border-border pt-4 mt-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Session</h3>
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
            <Field label="Entry Cutoff" field="entryCutoff" type="text" />
            <Field label="Square-Off" field="squareOff" type="text" />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
