// @ts-nocheck
import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import DashboardView from '@/components/features/Dashboard';
import HistoricalView from '@/components/features/Historical';
import AdvanceDeclineBar from '@/components/organisms/AdvanceDeclineBar';
import PredictionGauge from '@/components/organisms/PredictionGauge';
import { useDashboard } from '@/hooks';
import { selectPipelineStatus } from '@/store/slices/systemSlice';
import { selectBreadth } from '@/store/slices/regimeSlice';
import { BackfillProgress } from '@/components/features/Backfill';
import SwarmNotification from '@/components/features/Backfill/SwarmNotification';

export default function Home() {
  const { marketView, signals, systemStatus, loading, viewMode, setViewMode } = useDashboard();
  const pipelineStatus = useSelector(selectPipelineStatus);
  const breadth = useSelector(selectBreadth);
  const backfillData = pipelineStatus?.layers?.layer1?.backfill;
  const [isDismissed, setIsDismissed] = useState(false);

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

      {/* Stat row */}
      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="card stat">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary">NIFTY spot</div>
          <div className="text-2xl font-extrabold tabular-nums mt-0.5">{marketView?.indices?.NIFTY?.ltp?.toLocaleString() || '24,850.30'}</div>
          <div className={`text-xs font-semibold mt-1 flex items-center gap-1 ${marketView?.indices?.NIFTY?.change >= 0 ? 'text-success' : 'text-error'}`}>
            {marketView?.indices?.NIFTY?.change >= 0 ? '▲' : '▼'} {marketView?.indices?.NIFTY?.changePct?.toFixed(2)}%
          </div>
        </div>
        <div className="card stat">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary">BANKNIFTY spot</div>
          <div className="text-2xl font-extrabold tabular-nums mt-0.5">54,210.80</div>
          <div className="text-xs font-semibold mt-1 flex items-center gap-1 text-error">▼ −0.16%</div>
        </div>
        <div className="card stat">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary">India VIX</div>
          <div className="text-2xl font-extrabold tabular-nums mt-0.5">13.24</div>
          <div className="text-xs text-text-tertiary mt-1">Normal band · scalp-friendly</div>
        </div>
        <div className="card stat">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary">Day P&amp;L</div>
          <div className="text-2xl font-extrabold tabular-nums mt-0.5 text-success">+₹8,450</div>
          <div className="text-xs text-text-tertiary mt-1">of −₹2,500 loss limit · 3 trades</div>
        </div>
      </div>

      {/* Breadth + Pred row */}
      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <AdvanceDeclineBar advancing={breadth?.advancing || 38} declining={breadth?.declining || 12}
          aboveVwap={breadth?.aboveVwapPct || 74} aboveEma20={breadth?.aboveEma20Pct || 68}
          adRatio={breadth?.adRatio || 3.17} />
        <PredictionGauge pct={64} />
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
