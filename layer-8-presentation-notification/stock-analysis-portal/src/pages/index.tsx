// @ts-nocheck
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import DashboardView from '@/components/features/Dashboard';
import HistoricalView from '@/components/features/Historical';
import AdvanceDeclineBar from '@/components/organisms/AdvanceDeclineBar';
import PredictionGauge from '@/components/organisms/PredictionGauge';
import { useDashboard } from '@/hooks';
import { useIndexQuote } from '@/hooks/useMarket';
import { selectPipelineStatus } from '@/store/slices/systemSlice';
import { selectBreadth } from '@/store/slices/regimeSlice';
import { selectExecution } from '@/store/slices/executionSlice';
import { BackfillProgress } from '@/components/features/Backfill';
import SwarmNotification from '@/components/features/Backfill/SwarmNotification';

function IndexTile({ label, value, changeLabel, changeTone, footer }: { label: string; value: string; changeLabel?: string; changeTone?: string; footer?: string }) {
  return (
    <div className="card stat">
      <div className="text-[11px] uppercase tracking-wider text-text-tertiary">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums mt-0.5">{value}</div>
      {changeLabel && (
        <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${changeTone === 'pos' ? 'text-success' : changeTone === 'neg' ? 'text-error' : 'text-text-tertiary'}`}>
          {changeTone === 'pos' ? '▲' : changeTone === 'neg' ? '▼' : ''} {changeLabel}
        </div>
      )}
      {footer && <div className="text-xs text-text-tertiary mt-1">{footer}</div>}
    </div>
  );
}

export default function Home() {
  const { marketView, signals, systemStatus, loading, viewMode, setViewMode } = useDashboard();
  const pipelineStatus = useSelector(selectPipelineStatus);
  const breadth = useSelector(selectBreadth);
  const exec = useSelector(selectExecution);
  const backfillData = pipelineStatus?.layers?.layer1?.backfill;
  const [isDismissed, setIsDismissed] = useState(false);

  const niftyQuote = useIndexQuote('NIFTY');
  const bankQuote = useIndexQuote('BANKNIFTY');

  const niftyLtp = niftyQuote?.ltp;
  const niftyChg = niftyQuote?.changePct;
  const bankLtp = bankQuote?.ltp;
  const bankChg = bankQuote?.changePct;
  const dayPnl = exec?.risk?.dailyState?.totalPnl ?? exec?.dailyPnl ?? null;
  const tradesToday = exec?.risk?.dailyState?.tradesToday ?? null;
  const maxDailyLoss = exec?.risk?.maxDailyLoss ?? null;

  const fmtPrice = (v: number | undefined | null) => v != null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const fmtChange = (v: number | undefined | null) => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(2)}%` : '—';
  const fmtPnl = (v: number | undefined | null) => v != null ? `${v >= 0 ? '+' : '−'}₹${Math.abs(v).toLocaleString()}` : '—';

  useEffect(() => {
    if (backfillData?.status === 'running') setIsDismissed(false);
  }, [backfillData?.status]);

  return (
    <AppShell>
      <SwarmNotification />
      {backfillData && (backfillData.status === 'running' || (backfillData.status === 'completed' && !isDismissed)) && (
        <div className="mb-4">
          <BackfillProgress status={backfillData.status} progress={backfillData.progress} details={backfillData.details} onClose={() => setIsDismissed(true)} />
        </div>
      )}
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Overview</h1>
        <span className="text-sm text-text-tertiary">Morning glance · pre-market internals confirming</span>
        {breadth && (
          <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ml-auto ${breadth.adRatio > 1.2 ? 'badge-ok' : 'badge-warn'}`}>
            {breadth.adRatio > 1.2 ? 'CONFIRMING' : 'MIXED'}
          </span>
        )}
      </div>

      {/* Stat row — all values now derived from real API calls, never hardcoded */}
      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <IndexTile label="NIFTY spot" value={fmtPrice(niftyLtp)}
          changeLabel={fmtChange(niftyChg)} changeTone={niftyChg != null ? (niftyChg >= 0 ? 'pos' : 'neg') : undefined} />
        <IndexTile label="BANKNIFTY spot" value={fmtPrice(bankLtp)}
          changeLabel={fmtChange(bankChg)} changeTone={bankChg != null ? (bankChg >= 0 ? 'pos' : 'neg') : undefined} />
        <IndexTile label="India VIX" value="—" footer="Unavailable — VIX index token not configured" />
        <IndexTile label="Day P&amp;L" value={fmtPnl(dayPnl)} changeTone={dayPnl != null ? (dayPnl >= 0 ? 'pos' : 'neg') : undefined}
          footer={maxDailyLoss != null ? `of ₹${maxDailyLoss.toLocaleString()} limit · ${tradesToday ?? '—'} trades` : undefined} />
      </div>

      {/* Breadth + Pred row */}
      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <AdvanceDeclineBar advancing={breadth?.advancing ?? null} declining={breadth?.declining ?? null}
          aboveVwap={breadth?.aboveVwapPct ?? null} aboveEma20={breadth?.aboveEma20Pct ?? null}
          adRatio={breadth?.adRatio ?? null} breadth={breadth?.breadth ?? null} />
        <PredictionGauge pct={null} />
      </div>

      {/* LIVE/HISTORICAL toggle + main content */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex bg-surface border border-border rounded-lg p-0.5 gap-0.5">
          <button onClick={() => setViewMode('LIVE')} className={`text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${viewMode === 'LIVE' ? 'bg-primary text-white' : 'text-text-secondary'}`}>LIVE</button>
          <button onClick={() => setViewMode('HISTORICAL')} className={`text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${viewMode === 'HISTORICAL' ? 'bg-primary text-white' : 'text-text-secondary'}`}>HISTORICAL</button>
        </div>
      </div>
      {viewMode === 'LIVE' ? (
        <DashboardView marketView={marketView} signals={signals} loading={loading} />
      ) : (
        <HistoricalView />
      )}
    </AppShell>
  );
}
