import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout';

export default function RiskPage() {
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/v1/risk/config').then(r => r.json()).then(d => {
      if (d.success) setConfig(d.data);
    });
  }, []);

  const update = (key, value) => setConfig(prev => ({ ...prev, [key]: value }));

  const save = async () => {
    setSaving(true);
    await fetch('/api/v1/risk/config', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    setSaving(false);
  };

  if (!config) return <AppLayout><div className="p-8 text-text-tertiary">Loading...</div></AppLayout>;

  const Field = ({ label, keyName, type = 'number', min, max }) => (
    <div>
      <label className="text-sm text-text-tertiary block mb-1">{label}</label>
      <input type={type} min={min} max={max} value={config[keyName]} onChange={e => update(keyName, type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-full p-2 rounded-lg bg-surface border border-border text-text-primary text-sm" />
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Risk Configuration</h1>
            <p className="text-text-tertiary text-sm">Limits, sizing, cutoffs</p>
          </div>
          <button onClick={save} disabled={saving}
            className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Max Lots" keyName="maxLots" type="number" min={1} max={10} />
            <Field label="Max Concurrent Positions" keyName="maxConcurrent" type="number" min={1} max={5} />
            <Field label="Max Trades Per Day" keyName="maxTradesPerDay" type="number" min={1} max={50} />
            <Field label="Daily Loss Limit (₹)" keyName="maxDailyLoss" type="number" min={100} />
            <Field label="Risk Per Trade %" keyName="maxRiskPerTradePct" type="number" min={0.005} max={0.10} step={0.005} />
            <Field label="Trade Mode" keyName="mode" type="text" />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Session Cutoffs</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Entry Cutoff" keyName="entryCutoff" type="text" />
              <Field label="Square-Off Time" keyName="squareOff" type="text" />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
