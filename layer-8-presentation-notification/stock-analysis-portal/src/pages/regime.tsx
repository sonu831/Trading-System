// @ts-nocheck
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Activity, Shield } from 'lucide-react';
import { RegimeApi } from '@/api';

const TREND_ICON = { UP: TrendingUp, DOWN: TrendingDown, RANGE: Minus, REVERSING: Activity };

export default function RegimePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => RegimeApi.getLatest().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="min-h-screen bg-background text-text-primary p-6 flex items-center justify-center text-sm text-text-tertiary">Loading regime...</div>;
  if (!data) return <div className="min-h-screen bg-background text-text-primary p-6 flex items-center justify-center text-sm text-text-tertiary">— No regime data — L6 engine not publishing yet</div>;

  const trend = data.trend || 'RANGE';
  const TrendIcon = TREND_ICON[trend] || Minus;

  return (
    <div className="min-h-screen bg-background text-text-primary p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Market Regime</h1>
        <p className="text-sm text-text-tertiary">Trend, volatility, phase, and time-frame alignment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">Trend</div>
          <div className="flex items-center gap-3">
            <TrendIcon size={28} className={trend === 'UP' ? 'text-green-400' : trend === 'DOWN' ? 'text-red-400' : 'text-yellow-400'} />
            <span className={`text-2xl font-bold ${trend === 'UP' ? 'text-green-400' : trend === 'DOWN' ? 'text-red-400' : 'text-yellow-400'}`}>{trend}</span>
          </div>
          <div className="text-xs text-text-tertiary mt-2">Strength: {data.strength != null ? `${(Number(data.strength) * 100).toFixed(0)}%` : '—'}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">Volatility</div>
          <div className={`text-2xl font-bold ${data.volatility === 'HIGH' ? 'text-red-400' : data.volatility === 'LOW' ? 'text-blue-400' : 'text-green-400'}`}>
            {data.volatility || '—'}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">Phase</div>
          <div className={`text-2xl font-bold ${data.phase === 'BREAKOUT' ? 'text-green-400' : data.phase === 'EXHAUSTION' ? 'text-red-400' : 'text-text-primary'}`}>
            {data.phase || '—'}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-5">
          <div className="text-xs uppercase tracking-wider text-text-tertiary mb-2">Confidence</div>
          <div className="text-2xl font-bold text-text-primary">{data.confidence != null ? `${(Number(data.confidence) * 100).toFixed(0)}%` : '—'}</div>
        </div>
      </div>

      {data.tiers && (
        <div className="bg-surface border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-3">Tradeable Tiers Now</h3>
          <div className="space-y-2">
            {['T1', 'T2', 'T3'].map(t => {
              const tier = data.tiers?.[t] || {};
              const enabled = tier.enabled !== false;
              return (
                <div key={t} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="text-text-secondary">{t} — {tier.label || 'Scalp'}</span>
                  </div>
                  <span className={`text-xs font-mono ${enabled ? 'text-green-400' : 'text-red-400'}`}>
                    {enabled ? 'ENABLED' : 'STAND ASIDE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
