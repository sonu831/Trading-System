import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';

interface RiskConfig { maxLots: number; maxConcurrent: number; maxTradesPerDay: number; maxDailyLoss: number; maxRiskPerTradePct: number; entryCutoff: string; squareOff: string; mode: string; [key: string]: unknown; }

export default function RiskPage() {
  const [config, setConfig] = useState<RiskConfig | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => { fetch('/api/v1/risk/config').then(r => r.json()).then(d => { if (d.success) setConfig(d.data); }); }, []);

  const update = (key: string, value: unknown) => setConfig(prev => prev ? { ...prev, [key]: value } : null);
  const save = async () => { setSaving(true); await fetch('/api/v1/risk/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) }); setSaving(false); };

  if (!config) return <AppLayout><div className="p-8 text-text-tertiary">Loading...</div></AppLayout>;

  const Field = ({ label, field, type = 'number' }: { label: string; field: keyof RiskConfig; type?: string }) => (
    <div><label className="text-sm text-text-tertiary block mb-1">{label}</label><input type={type} value={String(config[field] ?? '')} onChange={e => update(field, type === 'number' ? Number(e.target.value) : e.target.value)} className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" /></div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6"><div><h1 className="text-2xl font-bold text-text-primary">Risk Configuration</h1><p className="text-text-tertiary text-sm">Limits, sizing, cutoffs</p></div><button onClick={save} disabled={saving} className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button></div>
        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4"><Field label="Max Lots" field="maxLots" /><Field label="Max Concurrent" field="maxConcurrent" /><Field label="Max Trades/Day" field="maxTradesPerDay" /><Field label="Daily Loss Limit (₹)" field="maxDailyLoss" /><Field label="Risk Per Trade %" field="maxRiskPerTradePct" /><Field label="Trade Mode" field="mode" type="text" /></div>
          <div className="border-t border-border pt-4"><h3 className="text-sm font-semibold text-text-primary mb-3">Session</h3><div className="grid grid-cols-2 gap-4"><Field label="Entry Cutoff" field="entryCutoff" type="text" /><Field label="Square-Off" field="squareOff" type="text" /></div></div>
        </div>
      </div>
    </AppLayout>
  );
}
