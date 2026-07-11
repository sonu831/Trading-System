/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import AppShell from '@/components/layout/AppShell/AppShell';
import PriceChart from '@/components/organisms/PriceChart';
import OptionChainGrid from '@/components/organisms/OptionChainGrid';
import StaleBadge from '@/components/trading/StaleBadge';
import { useIndexQuote, useCandles } from '@/hooks/useMarket';
import { selectBreadth } from '@/store/slices/regimeSlice';
import { selectCockpitTick } from '@/store/slices/cockpitSlice';
import { useSocket } from '@/hooks/useSocket';
import type { RegimeState, Position, BreadthState } from '@/shared/types';

export default function ScalpCockpit() {
  const router = useRouter();
  const underlying = (router.query.underlying as string) || 'NIFTY';
  const [timeframe, setTimeframe] = useState<string>('1m');

  const regime = useSelector((s: any) => (s as any).regime?.latest || {}) as RegimeState;
  const execState = useSelector((s: any) => (s as any).execution || {});
  const positions = (useSelector((s: any) => (s as any).execution?.positions || []) as Position[]) || [];
  const breadth = useSelector(selectBreadth) as BreadthState | null;

  // WebSocket real-time spot
  const { subscribe } = useSocket();
  const tick = useSelector(selectCockpitTick);
  const wsSpot = tick[underlying]?.ltp;

  const quote = useIndexQuote(underlying);
  const candles = useCandles(underlying, timeframe);
  const dayPnl: number = execState?.dailyPnl ?? 0;
  const regimeTs = (regime as any)?.timestamp;

  useEffect(() => {
    subscribe(`cockpit:${underlying}`);
  }, [underlying, subscribe]);

  const spot = wsSpot ?? quote?.ltp;

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Scalp Cockpit</h1>
        <span className="text-sm text-text-tertiary">{underlying} · current weekly · ITM-1 default</span>
        {regime && <span className="badge badge-ok text-xs font-bold px-2.5 py-1 rounded-full border ml-auto">ENGINE ONLINE</span>}
      </div>

      {/* Main 3-col grid */}
      <div className="grid gap-4
        grid-cols-1
        md:grid-cols-2
        lg:grid-cols-3
        xl:grid-cols-[1fr_320px_320px]">

        {/* Chart */}
        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1 min-h-[360px]">
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

        {/* Hero + context */}
        <div className="flex flex-col gap-4">
          <div className="card">
            <h2 className="text-sm font-bold mb-1">Day P&amp;L</h2>
            <div className={`text-2xl font-bold tabular-nums ${dayPnl >= 0 ? 'text-success' : 'text-error'}`}>
              {dayPnl === 0 ? '—' : `₹${dayPnl.toLocaleString()}`}
            </div>
          </div>
          <div className="card flex-1">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold">Engine Intent</h2>
              <span className="badge badge-accent text-xs font-bold px-2 py-1 rounded-full border">PREVIEW</span>
            </div>
            <div className="kv"><span className="text-xs text-text-secondary">Buy</span><span className="font-semibold text-sm tabular-nums">24,850 CE</span></div>
            <div className="kv"><span className="text-xs text-text-secondary">Premium</span><span className="font-semibold text-sm tabular-nums">₹168.30</span></div>
            <div className="kv"><span className="text-xs text-text-secondary">Stop</span><span className="text-error font-semibold text-sm">−18% · ₹138</span></div>
            <div className="kv"><span className="text-xs text-text-secondary">Target</span><span className="text-success font-semibold text-sm">+30% · ₹219</span></div>
            <button className="btn-primary w-full justify-center mt-3 text-sm">Arm entry (PAPER)</button>
            <div className="flex gap-1.5 mt-3 flex-wrap">
              <span className="badge badge-ok text-[10px] font-bold px-2 py-1 rounded-full border">UP 64%</span>
              <span className="badge badge-ok text-[10px] font-bold px-2 py-1 rounded-full border">Breadth ✓</span>
              <span className="badge badge-ok text-[10px] font-bold px-2 py-1 rounded-full border">T1 open</span>
            </div>
          </div>
        </div>

        {/* Option Chain */}
        <div className="md:col-span-2 lg:col-span-1 xl:col-span-1">
          <OptionChainGrid underlying={underlying} />
        </div>
      </div>

      {/* Context row — regime + breadth */}
      <div className="grid gap-4 mt-4 grid-cols-1 md:grid-cols-3">
        {Object.keys(regime).length > 0 ? (
          <div className="card text-xs space-y-1">
            <div className="text-text-primary font-semibold">Regime: {(regime as any).trend || '—'}</div>
            <div className="text-text-tertiary">Strength: {(regime as any).strength ?? '—'} · Phase: {(regime as any).phase || '—'}</div>
          </div>
        ) : (
          <div className="card text-text-tertiary text-sm text-center"><StaleBadge timestamp={regimeTs} /><div className="mt-1">Waiting for regime...</div></div>
        )}
        {breadth ? (
          <div className="card text-xs space-y-1">
            <div className="text-text-primary font-semibold">Breadth</div>
            <div className="text-text-tertiary">A/D: {breadth.advancing}/{breadth.declining} ({(breadth.adRatio ?? 0).toFixed(1)})</div>
            <div className="text-text-tertiary">&gt;EMA20: {breadth.aboveEma20Pct?.toFixed(0) ?? '—'}% · &gt;VWAP: {breadth.aboveVwapPct?.toFixed(0) ?? '—'}%</div>
          </div>
        ) : (
          <div className="card text-text-tertiary text-sm text-center">A/D: — · &gt;EMA20: —%</div>
        )}
        <div className="card text-xs text-text-tertiary text-center flex items-center justify-center">
          {positions.length} open positions · Signals via Socket.io
        </div>
      </div>
    </AppShell>
  );
}
