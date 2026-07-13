// @ts-nocheck
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import PredictionGauge from '@/components/organisms/PredictionGauge';
import FeatureContributions from '@/components/organisms/FeatureContributions';
import { PredictApi } from '@/api';

export default function PredictionsPage() {
  const [horizon, setHorizon] = useState('scalp');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchPred = async () => {
      try {
        const data = await PredictApi.get('NIFTY', horizon);
        if (data && data.status !== 'abstain' && data.status !== 'not_trained') {
          if (active) setPrediction(data);
        } else {
          if (active) setPrediction(null);
        }
      } catch (_) {
        if (active) setPrediction(null);
      }
      if (active) setLoading(false);
    };
    fetchPred();
    return () => { active = false; };
  }, [horizon]);

  const pct = prediction?.probability ? Math.round(prediction.probability * 100) : null;
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
      {loading ? (
        <div className="card text-center py-10 text-text-tertiary">Loading prediction model...</div>
      ) : prediction ? (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <PredictionGauge
            pct={pct}
            horizon={label}
            direction={prediction.direction}
            confidence={prediction.confidence ?? null}
            model={prediction.model_version || 'lstm-breadth v0.3'}
          />
          <FeatureContributions features={prediction.features || []} />
        </div>
      ) : (
        <div className="card text-center py-12">
          <div className="text-3xl mb-3">🧠</div>
          <p className="text-text-secondary font-semibold mb-1">Prediction model abstaining</p>
          <p className="text-xs text-text-tertiary max-w-md mx-auto">
            The breadth-based LSTM model has not completed its Phase-0 validation study.
            Predictions will appear here once the model demonstrates a post-cost edge.
            Until then, the cockpit renders the abstain state — never a fabricated number.
          </p>
        </div>
      )}
    </AppShell>
  );
}
