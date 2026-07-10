/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import SafetyBar from '@/components/organisms/SafetyBar';
import PriceChart from '@/components/organisms/PriceChart';
import CockpitTemplate from '@/components/templates/CockpitTemplate';
import StaleBadge from '@/components/trading/StaleBadge';
import { useIndexQuote, useCandles } from '@/hooks/useMarket';
import { selectBreadth } from '@/store/slices/regimeSlice';
import type { RegimeState, Position, BreadthState } from '@/shared/types';

export default function ScalpCockpit() {
  const router = useRouter();
  const underlying = (router.query.underlying as string) || 'NIFTY';
  const [timeframe, setTimeframe] = useState<string>('1m');

  const regime = useSelector((s: any) => (s as any).regime?.latest || {}) as RegimeState;
  const execState = useSelector((s: any) => (s as any).execution || {});
  const positions = (useSelector((s: any) => (s as any).execution?.positions || []) as Position[]) || [];
  const breadth = useSelector(selectBreadth) as BreadthState | null;

  const quote = useIndexQuote(underlying);
  const candles = useCandles(underlying, timeframe);
  const dayPnl: number = execState?.dailyPnl ?? 0;
  const regimeTs = (regime as any)?.timestamp;

  return (
    <CockpitTemplate
      safetyBar={<SafetyBar underlying={underlying} spot={quote?.ltp} regimeUpdatedAt={regimeTs} />}
      chart={
        <div>
          <div className="flex gap-1 mb-2">
            {(['1m', '5m', '15m', '1h'] as string[]).map((tf: string) => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-xs rounded ${timeframe === tf ? 'bg-primary text-white' : 'bg-surface border border-border text-text-tertiary'}`}>
                {tf}
              </button>
            ))}
          </div>
          <PriceChart candles={candles} timeframe={timeframe} />
        </div>
      }
      hero={
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs text-text-tertiary mb-1">Day P&amp;L</div>
          <div className={`text-2xl font-bold tabular-nums ${dayPnl >= 0 ? 'text-success' : 'text-error'}`}>
            {dayPnl === 0 ? '\u2014' : `\u20B9${dayPnl.toLocaleString()}`}
          </div>
        </div>
      }
      chain={
        <div className="text-xs text-text-tertiary text-center p-4 bg-surface border border-border rounded-xl">
          Option chain streams via Socket.io — ensure the option-chain poller is running
        </div>
      }
      context={
        <div className="space-y-4">
          {Object.keys(regime).length > 0 ? (
            <div className="bg-surface border border-border rounded-xl p-4 text-xs space-y-1">
              <div className="text-text-primary font-semibold">
                Regime: {(regime as any).trend || '\u2014'}
              </div>
              <div className="text-text-tertiary">
                Strength: {(regime as any).strength ?? '\u2014'} · Phase: {(regime as any).phase || '\u2014'}
              </div>
              {breadth ? (
                <>
                  <div className="text-text-tertiary">
                    A/D: {breadth.advancing}/{breadth.declining}{' '}
                    ({(breadth.adRatio ?? 0).toFixed(1)})
                  </div>
                  <div className="text-text-tertiary">
                    {'>'}EMA20: {breadth.aboveEma20Pct?.toFixed(0) ?? '\u2014'}%{' · '}
                    {'>'}VWAP: {breadth.aboveVwapPct?.toFixed(0) ?? '\u2014'}%
                  </div>
                </>
              ) : (
                <div className="text-text-tertiary">A/D: {'\u2014'} · {'>'}EMA20: {'\u2014'}% · VIX: {'\u2014'}</div>
              )}
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl p-4 text-text-tertiary text-sm text-center">
              <StaleBadge timestamp={regimeTs} />
              <div className="mt-2">Waiting for regime data...</div>
            </div>
          )}
        </div>
      }
      details={
        <div className="space-y-4 text-xs text-text-tertiary text-center">
          {positions.length} positions · Signals via Socket.io
        </div>
      }
    />
  );
}
