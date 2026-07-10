import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import SafetyBar from '@/components/organisms/SafetyBar';
import PriceChart from '@/components/organisms/PriceChart';
import CockpitTemplate from '@/components/templates/CockpitTemplate';
import StaleBadge from '@/components/trading/StaleBadge';
import { useIndexQuote, useCandles } from '@/hooks/useMarket';
import type { IndexQuote, CandleData, RegimeState, Position } from '@/shared/types';

export default function ScalpCockpit() {
  const router = useRouter();
  const underlying = (router.query.underlying as string) || 'NIFTY';
  const [timeframe, setTimeframe] = useState<string>('1m');

  const regime = useSelector((s: any) => s.regime?.latest || {}) as RegimeState;
  const execState = useSelector((s: any) => s.execution || {});
  const positions = (useSelector((s: any) => s.execution?.positions || []) as Position[]) || [];

  const quote = useIndexQuote(underlying);
  const candles = useCandles(underlying, timeframe);
  const dayPnl: number = execState?.dailyPnl ?? 0;

  return (
    <CockpitTemplate
      safetyBar={<SafetyBar underlying={underlying} spot={quote?.ltp} regimeUpdatedAt={regime?.timestamp} />}
      chart={
        <div>
          <div className="flex gap-1 mb-2">
            {['1m', '5m', '15m', '1h'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-xs rounded ${timeframe === tf ? 'bg-primary text-white' : 'bg-surface border border-border text-text-tertiary'}`}>
                {tf}
              </button>
            ))}
          </div>
          <PriceChart candles={candles} timeframe={timeframe} />
        </div>
      }
      hero={<div className="space-y-4 text-text-primary text-sm">Day P&L: ₹{dayPnl.toLocaleString()}</div>}
      context={
        <div className="space-y-4">
          {Object.keys(regime).length > 0 ? (
            <div className="bg-surface border border-border rounded-xl p-4 text-xs">
              <div className="text-text-primary font-semibold">Regime: {(regime as any).trend || '—'}</div>
              <div className="text-text-tertiary">Strength: {(regime as any).strength ?? '—'} · Phase: {(regime as any).phase || '—'}</div>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-4 text-text-tertiary text-sm text-center">
              <StaleBadge updatedAt={(regime as any)?.timestamp} label="Regime" />
            </div>
          )}
          <div className="bg-surface border border-border rounded-xl p-4 text-xs text-text-tertiary">
            <span>{'A/D: —'} · {'>EMA20: —%'} · VIX: —</span>
          </div>
        </div>
      }
      details={
        <div className="space-y-4">
          <div className="text-xs text-text-tertiary">
            {positions.length} positions · Signals · Orders (Phase 5)
          </div>
        </div>
      }
    />
  );
}
