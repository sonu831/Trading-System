// @ts-nocheck
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import { Layers, Activity, Ban, Hash, TrendingUp, XOctagon } from 'lucide-react';
import SafetyBar from '@/components/organisms/SafetyBar';
import PriceChart from '@/components/organisms/PriceChart';
import OptionChainGrid from '@/components/organisms/OptionChainGrid';
import ConfluenceChecklist from '@/components/organisms/ConfluenceChecklist';
import StrikePreviewCard from '@/components/organisms/StrikePreviewCard';
import {
  StatTile,
  DailyRiskCard,
  PositionsTable,
  TradeModeBadge,
  StaleBadge,
  ConfirmDialog,
} from '@/components/trading';
import { RegimeCard } from '@/components/regime';
import {
  fetchExecutionState,
  squareOffAll,
  selectExecution,
  selectOpenPositions,
  selectUnrealisedPnl,
} from '@/store/slices/executionSlice';
import { fetchRegime, selectRegime, selectRegimeUpdatedAt, selectRegimeReachable } from '@/store/slices/regimeSlice';
import { selectCockpitTick } from '@/store/slices/cockpitSlice';
import { useSocket } from '@/hooks/useSocket';
import { useCandles } from '@/hooks/useMarket';
import {
  EMPTY, formatSignedCurrency, formatCurrency, formatNumber, pnlDirection,
} from '@/utils/format';

const POLL_MS = 3000;

function DayPnlHero({ realised, unrealised, reachable }) {
  const known = Number.isFinite(realised) || Number.isFinite(unrealised);
  const total = known ? (realised || 0) + (unrealised || 0) : null;
  const dir = pnlDirection(total);
  const tone = dir === 'up' ? 'text-success' : dir === 'down' ? 'text-error' : 'text-text-primary';

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="text-xs uppercase tracking-wider text-text-tertiary">Day P&amp;L</div>
      <div className={`mt-2 text-4xl font-semibold leading-none ${known ? tone : 'text-text-tertiary'}`}>
        {reachable === false ? EMPTY : formatSignedCurrency(total)}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
        <span>Realised <span className="text-text-secondary tabular-nums">{formatCurrency(realised)}</span></span>
        <span>Unrealised <span className="text-text-secondary tabular-nums">{formatCurrency(unrealised)}</span></span>
      </div>
    </div>
  );
}

export default function CockpitDashboard() {
  const dispatch = useDispatch();
  const router = useRouter();
  const underlying = (router.query.u as string) || 'NIFTY';
  const [timeframe, setTimeframe] = useState('1m');
  const [confirmSquareOff, setConfirmSquareOff] = useState(false);

  // Redux state
  const { mode, killSwitch, risk, loading, mutating, lastUpdatedAt, reachable, error } = useSelector(selectExecution);
  const openPositions = useSelector(selectOpenPositions);
  const unrealised = useSelector(selectUnrealisedPnl);
  const regime = useSelector(selectRegime);
  const regimeUpdatedAt = useSelector(selectRegimeUpdatedAt);
  const regimeReachable = useSelector(selectRegimeReachable);

  // WebSocket real-time data via cockpitSlice
  const { subscribe } = useSocket();
  const tick = useSelector(selectCockpitTick);
  const spot = tick[underlying]?.ltp ?? null;

  // REST fallback for candles
  const candles = useCandles(underlying, timeframe);

  useEffect(() => {
    subscribe(`cockpit:${underlying}`);
  }, [underlying, subscribe]);

  useEffect(() => {
    const load = () => {
      dispatch(fetchExecutionState());
      dispatch(fetchRegime());
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  const realised = Number.isFinite(risk?.dailyState?.totalPnl) ? risk.dailyState.totalPnl : null;
  const tradesToday = Number.isFinite(risk?.dailyState?.tradesToday) ? risk.dailyState.tradesToday : null;

  const handleSquareOff = async () => {
    await dispatch(squareOffAll());
    setConfirmSquareOff(false);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* ── STICKY SAFETY BAR ── */}
      <SafetyBar underlying={underlying} spot={spot} regimeUpdatedAt={regimeUpdatedAt} />

      {/* ── PAGE HEADER ── */}
      <div className="px-4 pt-3 pb-1 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Cockpit</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <StaleBadge timestamp={lastUpdatedAt} />
            {error ? <span className="text-xs text-error">· {error}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TradeModeBadge mode={mode || undefined} />
          <button
            type="button" onClick={() => setConfirmSquareOff(true)}
            disabled={mutating || openPositions.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-error/50 text-error hover:bg-error/10 transition disabled:opacity-40"
          >
            <Ban size={13} /> Square off
          </button>
        </div>
      </div>

      {/* ── MAIN GRID: Chart + Chain + Sidebar ── */}
      <div className="grid gap-4 px-4 pb-4
        grid-cols-1
        xl:grid-cols-[1fr_340px]
        2xl:grid-cols-[1fr_340px_340px]">

        {/* Left: Chart + Hero + Risk */}
        <div className="flex flex-col gap-4">
          {/* Timeframe buttons */}
          <div className="flex gap-1">
            {(['1m', '5m', '15m', '1h']).map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs rounded font-medium transition ${
                  timeframe === tf ? 'bg-primary text-white' : 'bg-surface border border-border text-text-tertiary hover:text-text-secondary'
                }`}>
                {tf}
              </button>
            ))}
          </div>
          <div className="bg-surface border border-border rounded-xl overflow-hidden min-h-[350px] xl:min-h-[420px]">
            <PriceChart candles={candles} timeframe={timeframe} />
          </div>

          {/* Hero + KPI row under chart */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <DayPnlHero realised={realised} unrealised={unrealised} reachable={reachable} />
            <StatTile label="Open positions" icon={<Layers size={13} />} value={reachable === false ? EMPTY : formatNumber(openPositions.length)} footnote={Number.isFinite(risk?.maxConcurrent) ? `max ${risk.maxConcurrent} concurrent` : null} />
            <StatTile label="Trades today" icon={<Hash size={13} />} value={reachable === false ? EMPTY : formatNumber(tradesToday)} footnote={Number.isFinite(risk?.maxTradesPerDay) ? `max ${risk.maxTradesPerDay} per day` : null} />
            <StatTile label="Unrealised" icon={<TrendingUp size={13} />} value={formatSignedCurrency(unrealised)} tone={unrealised > 0 ? 'positive' : unrealised < 0 ? 'negative' : 'neutral'} />
          </div>

          {/* Positions table */}
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Activity size={15} className="text-text-tertiary" />
                Open positions
              </h2>
              <span className="text-xs text-text-tertiary">{openPositions.length > 0 ? `${openPositions.length} live` : null}</span>
            </div>
            <PositionsTable positions={openPositions} loading={loading} reachable={reachable === false ? false : undefined} />
          </div>
        </div>

        {/* Center: Option Chain */}
        <div className="xl:col-span-1 2xl:col-span-1">
          <OptionChainGrid underlying={underlying} />
        </div>

        {/* Right sidebar (only on 2xl): Risk + Regime + Confluence + Strike */}
        <div className="hidden 2xl:flex flex-col gap-4">
          <DailyRiskCard risk={risk} killSwitch={killSwitch === true} />
          <RegimeCard regime={regime} lastUpdatedAt={regimeUpdatedAt} reachable={regimeReachable === false ? false : undefined} />
          <ConfluenceChecklist regime={regime} />
          <StrikePreviewCard underlying={underlying} />
        </div>
      </div>

      {/* ── Bottom panels (visible on non-2xl) ── */}
      <div className="hidden xl:grid 2xl:hidden grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 pb-6">
        <DailyRiskCard risk={risk} killSwitch={killSwitch === true} />
        <RegimeCard regime={regime} lastUpdatedAt={regimeUpdatedAt} reachable={regimeReachable === false ? false : undefined} />
        <ConfluenceChecklist regime={regime} />
        <StrikePreviewCard underlying={underlying} />
      </div>

      <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pb-6">
        <DailyRiskCard risk={risk} killSwitch={killSwitch === true} />
        <RegimeCard regime={regime} lastUpdatedAt={regimeUpdatedAt} reachable={regimeReachable === false ? false : undefined} />
        <ConfluenceChecklist regime={regime} />
        <StrikePreviewCard underlying={underlying} />
      </div>

      <ConfirmDialog
        isOpen={confirmSquareOff}
        title={`Square off ${openPositions.length} position${openPositions.length === 1 ? '' : 's'}?`}
        description="All open positions will be closed at market. Stop-loss orders are cancelled first."
        confirmLabel="Square off all"
        busy={mutating}
        onConfirm={handleSquareOff}
        onCancel={() => setConfirmSquareOff(false)}
      />
    </div>
  );
}
