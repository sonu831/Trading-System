// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Layers, Activity, Ban, Hash } from 'lucide-react';
import AppShell from '@/components/layout/AppShell/AppShell';
import {
  StatTile,
  DailyRiskCard,
  PositionsTable,
  TradeModeBadge,
  StaleBadge,
  ConfirmDialog,
} from '@/components/trading';
import { RegimeCard } from '@/components/regime';
import ConfluenceChecklist from '@/components/organisms/ConfluenceChecklist';
import StrikePreviewCard from '@/components/organisms/StrikePreviewCard';
import {
  fetchExecutionState,
  squareOffAll,
  selectExecution,
  selectOpenPositions,
  selectUnrealisedPnl,
} from '@/store/slices/executionSlice';
import { fetchRegime, selectRegime, selectRegimeUpdatedAt, selectRegimeReachable, fetchBreadth, selectBreadth } from '@/store/slices/regimeSlice';
import {
  EMPTY,
  formatSignedCurrency,
  formatCurrency,
  formatNumber,
  pnlDirection,
} from '@/utils/format';

const POLL_MS = 3000;

/** The one hero figure on this view. >=48px, proportional figures (never tabular). */
function DayPnlHero({ realised, unrealised, reachable }) {
  const known = Number.isFinite(realised) || Number.isFinite(unrealised);
  const total = known ? (realised || 0) + (unrealised || 0) : null;
  const dir = pnlDirection(total);

  const tone =
    dir === 'up' ? 'text-success' : dir === 'down' ? 'text-error' : 'text-text-primary';

  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <div className="text-xs uppercase tracking-wider text-text-tertiary">Day P&amp;L</div>

      <div className={`mt-2 text-5xl font-semibold leading-none ${known ? tone : 'text-text-tertiary'}`}>
        {reachable === false ? EMPTY : formatSignedCurrency(total)}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-text-tertiary">
        <span>
          Realised{' '}
          <span className="text-text-secondary tabular-nums">{formatCurrency(realised)}</span>
        </span>
        <span>
          Unrealised{' '}
          <span className="text-text-secondary tabular-nums">{formatCurrency(unrealised)}</span>
        </span>
      </div>

      {reachable === false ? (
        <p className="mt-3 text-xs text-error">Execution engine unreachable.</p>
      ) : null}
    </div>
  );
}

export default function TradingPage() {
  const dispatch = useDispatch();
  const { mode, killSwitch, risk, loading, mutating, lastUpdatedAt, reachable, error } =
    useSelector(selectExecution);
  const openPositions = useSelector(selectOpenPositions);
  const unrealised = useSelector(selectUnrealisedPnl);

  const regime = useSelector(selectRegime);
  const regimeUpdatedAt = useSelector(selectRegimeUpdatedAt);
  const regimeReachable = useSelector(selectRegimeReachable);
  const breadth = useSelector(selectBreadth);

  const [confirmSquareOff, setConfirmSquareOff] = useState(false);

  useEffect(() => {
    const load = () => {
      dispatch(fetchExecutionState());
      dispatch(fetchRegime());
      dispatch(fetchBreadth());
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  const realised = Number.isFinite(risk?.dailyState?.totalPnl) ? risk.dailyState.totalPnl : null;
  const tradesToday = Number.isFinite(risk?.dailyState?.tradesToday)
    ? risk.dailyState.tradesToday
    : null;

  const handleSquareOff = async () => {
    await dispatch(squareOffAll());
    setConfirmSquareOff(false);
  };

  return (
    <AppShell>
      {/* ---- Header: mode, freshness, destructive action ---- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Trading</h1>
          <div className="flex items-center gap-3 mt-1">
            <StaleBadge timestamp={lastUpdatedAt} />
            {error ? <span className="text-xs text-error">· {error}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TradeModeBadge mode={mode || undefined} />
          <button
            type="button"
            onClick={() => setConfirmSquareOff(true)}
            disabled={mutating || openPositions.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-error/50 text-error hover:bg-error/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Ban size={15} aria-hidden="true" />
            Square off all
          </button>
        </div>
      </div>

      {/* ---- Hero + KPI row ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <div className="lg:col-span-2">
          <DayPnlHero realised={realised} unrealised={unrealised} reachable={reachable} />
        </div>

        <StatTile
          label="Open positions"
          icon={<Layers size={13} />}
          value={reachable === false ? EMPTY : formatNumber(openPositions.length)}
          footnote={
            Number.isFinite(risk?.maxConcurrent) ? `max ${risk.maxConcurrent} concurrent` : null
          }
        />

        <StatTile
          label="Trades today"
          icon={<Hash size={13} />}
          value={reachable === false ? EMPTY : formatNumber(tradesToday)}
          footnote={
            Number.isFinite(risk?.maxTradesPerDay) ? `max ${risk.maxTradesPerDay} per day` : null
          }
        />
      </div>

      {/* ---- Main grid: book (2/3) + risk & regime (1/3) ---- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Activity size={15} className="text-text-tertiary" aria-hidden="true" />
                Open positions
              </h2>
              <span className="text-xs text-text-tertiary">
                {openPositions.length > 0 ? `${openPositions.length} live` : null}
              </span>
            </div>
            <PositionsTable
              positions={openPositions}
              loading={loading}
              reachable={reachable === false ? false : undefined}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <DailyRiskCard risk={risk} killSwitch={killSwitch === true} />
          <RegimeCard
            regime={regime}
            lastUpdatedAt={regimeUpdatedAt}
            reachable={regimeReachable === false ? false : undefined}
          />
          <ConfluenceChecklist regime={regime} breadth={breadth} />
          <StrikePreviewCard underlying="NIFTY" />
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmSquareOff}
        title={`Square off ${openPositions.length} position${openPositions.length === 1 ? '' : 's'}?`}
        description={
          <>
            All open positions will be closed at <strong>market</strong>. Resting stop-loss orders are
            cancelled first. This cannot be undone.
          </>
        }
        confirmLabel="Square off all"
        busy={mutating}
        onConfirm={handleSquareOff}
        onCancel={() => setConfirmSquareOff(false)}
      />
    </AppShell>
  );
}
