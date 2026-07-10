// @ts-nocheck
import { useState } from 'react';
import { useStrikePreview } from '@/hooks/useMarket';

export default function StrikePreviewCard({ underlying = 'NIFTY' }) {
  const [direction, setDirection] = useState('LONG');
  const preview = useStrikePreview(underlying, direction);

  const f = (n) => n != null ? Number(n).toFixed(2) : '—';
  const fC = (n) => n != null ? '₹' + Math.round(n).toLocaleString() : '—';

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Engine Intent</h3>
        <div className="flex gap-1">
          {['LONG', 'SHORT'].map(d => (
            <button key={d} onClick={() => setDirection(d)}
              className={`px-2 py-0.5 text-xs rounded ${direction === d ? (d === 'LONG' ? 'bg-success/20 text-success' : 'bg-error/20 text-error') : 'bg-surface border border-border text-text-tertiary'}`}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {preview?.nfoSymbol ? (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span className="text-text-tertiary">Contract</span><span className="text-text-primary font-mono">{preview.nfoSymbol}</span></div>
          <div className="flex justify-between"><span className="text-text-tertiary">Strike</span><span className="text-text-primary">{preview.strike} ({preview.optionType} · {preview.moneyness})</span></div>
          <div className="flex justify-between"><span className="text-text-tertiary">Entry Premium</span><span className="text-text-primary">{f(preview.premium)}</span></div>
          <div className="flex justify-between"><span className="text-text-tertiary">Lots</span><span className="text-text-primary">{preview.lots} × {preview.lotSize} = {preview.quantity} qty</span></div>
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between"><span className="text-text-tertiary">Stop Loss</span><span className="text-error">{f(preview.slPrice)}</span></div>
            <div className="flex justify-between"><span className="text-text-tertiary">Target</span><span className="text-success">{f(preview.targetPrice)}</span></div>
          </div>
          <div className="border-t border-border pt-2 mt-2">
            <div className="flex justify-between"><span className="text-text-tertiary">₹ Risk</span><span className="text-error">{fC(preview.risk)}</span></div>
            <div className="flex justify-between"><span className="text-text-tertiary">₹ Reward</span><span className="text-success">{fC(preview.reward)}</span></div>
            <div className="flex justify-between"><span className="text-text-tertiary">R:R</span><span className="text-text-primary font-semibold">{preview.riskReward?.toFixed(2) || '—'}</span></div>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-text-tertiary text-xs">Loading...</div>
      )}
    </div>
  );
}
