// @ts-nocheck
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, BarChart2, PieChart } from 'lucide-react';
import { BreadthApi } from '@/api';
import { formatNumber, formatPercent } from '@/utils/format';

export default function MarketInternalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => BreadthApi.getLatest().then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="min-h-screen bg-background text-text-primary p-6 flex items-center justify-center text-sm text-text-tertiary">Loading market internals...</div>;
  if (!data) return <div className="min-h-screen bg-background text-text-primary p-6 flex items-center justify-center text-sm text-text-tertiary">— No breadth data available</div>;

  const adRatio = data.adRatio != null ? Number(data.adRatio) : null;

  return (
    <div className="min-h-screen bg-background text-text-primary p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Market Internals</h1>
        <p className="text-sm text-text-tertiary">Derive the index from its stocks — breadth, sectors, heavyweight contributions</p>
      </div>

      {/* A/D Meter */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricTile label="Advancing" value={data.advancing ?? '—'} color="text-green-400" icon={TrendingUp} />
        <MetricTile label="Declining" value={data.declining ?? '—'} color="text-red-400" icon={TrendingDown} />
        <MetricTile label="Unchanged" value={data.unchanged ?? '—'} color="text-yellow-400" icon={BarChart2} />
      </div>

      {/* A/D Ratio */}
      <div className="bg-surface border border-border rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-text-tertiary">Advance/Decline Ratio</div>
            <div className={`text-3xl font-semibold mt-1 ${adRatio ? (adRatio > 1 ? 'text-green-400' : 'text-red-400') : 'text-text-tertiary'}`}>
              {adRatio ? adRatio.toFixed(2) : '—'}
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {adRatio != null ? (adRatio > 1.5 ? 'Strongly bullish breadth' : adRatio > 1.2 ? 'Bullish breadth' : adRatio < 0.8 ? 'Bearish breadth' : 'Neutral breadth') : ''}
            </div>
          </div>
          <BarChart2 size={32} className={adRatio && adRatio > 1 ? 'text-green-400' : 'text-red-400'} />
        </div>
      </div>

      {/* Breadth details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricTile label="% Above VWAP" value={data.aboveVwapPct != null ? formatPercent(data.aboveVwapPct) : '—'} color="text-blue-400" />
        <MetricTile label="% Above 20 EMA" value={data.above20EmaPct != null ? formatPercent(data.above20EmaPct) : '—'} color="text-purple-400" />
        <MetricTile label="New Highs" value={data.newHighs ?? '—'} color="text-green-400" />
        <MetricTile label="New Lows" value={data.newLows ?? '—'} color="text-red-400" />
        <MetricTile label="McClellan Osc" value={data.mcclellanOsc != null ? Number(data.mcclellanOsc).toFixed(2) : '—'} color="text-cyan-400" />
        <MetricTile label="Sectors Tracked" value={data.sectorCount ?? '—'} color="text-text-secondary" />
      </div>
    </div>
  );
}

function MetricTile({ label, value, color = 'text-text-secondary', icon: Icon }: any) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
      <div>
        <div className="text-xs text-text-tertiary">{label}</div>
        <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>
      </div>
      {Icon && <Icon size={20} className={color} />}
    </div>
  );
}
