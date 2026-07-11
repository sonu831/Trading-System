// @ts-nocheck
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import PredictionGauge from '@/components/organisms/PredictionGauge';
import FeatureContributions from '@/components/organisms/FeatureContributions';

export default function PredictionsPage() {
  const [horizon, setHorizon] = useState('scalp');
  const pct = horizon === 'scalp' ? 64 : 71;
  const label = horizon === 'scalp' ? 'SCALP · 1–5m' : 'POSITIONAL · hrs–days';

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Predictions</h1>
        <span className="text-sm text-text-tertiary">Breadth-based predictive model · confluence input, not a trigger</span>
        <div className="ml-auto flex border border-border rounded-lg p-0.5 gap-0.5 bg-surface">
          <button onClick={() => setHorizon('scalp')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${horizon === 'scalp' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
            Scalp 1–5m
          </button>
          <button onClick={() => setHorizon('positional')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${horizon === 'positional' ? 'bg-primary text-white' : 'text-text-secondary'}`}>
            Positional
          </button>
        </div>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        <PredictionGauge pct={pct} horizon={label} />
        <FeatureContributions />
      </div>
    </AppShell>
  );
}
