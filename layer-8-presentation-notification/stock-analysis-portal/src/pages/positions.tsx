import { useSelector } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import PositionsTable from '@/components/trading/PositionsTable';
import DailyRiskCard from '@/components/trading/DailyRiskCard';
import StatTile from '@/components/trading/StatTile';
import type { Position } from '@/shared/types';

export default function PositionsPage() {
  const execState = useSelector((s: any) => s.execution || {});
  const positions = (execState?.positions || []) as Position[];
  const dayPnl: number = execState?.dailyPnl ?? 0;
  const openPositions = positions.filter((p: Position) => p.status === 'OPEN');

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Positions &amp; P&amp;L</h1>
        <span className="text-sm text-text-tertiary">{openPositions.length} open · long premium only</span>
      </div>

      <div className="grid gap-3.5 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="card stat">
          <div className="text-[11px] uppercase tracking-wider text-text-tertiary">Day P&amp;L</div>
          <div className={`text-2xl font-extrabold tabular-nums mt-0.5 ${dayPnl >= 0 ? 'text-success' : 'text-error'}`}>
            {dayPnl === 0 ? '—' : `₹${dayPnl.toLocaleString()}`}
          </div>
        </div>
        <StatTile label="Open Positions" value={openPositions.length} />
        <StatTile label="Mode" value={execState?.mode || 'paper'} />
      </div>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
        <div className="overflow-x-auto border border-border rounded-xl">
          {openPositions.length > 0 ? (
            <PositionsTable positions={openPositions} />
          ) : (
            <div className="p-8 text-center text-text-tertiary">No open positions — signals will appear here when the strategy triggers</div>
          )}
        </div>
        <DailyRiskCard risk={execState?.risk} killSwitch={execState?.killSwitch === true} />
      </div>

      {openPositions.some((p: any) => !p.slOrderId) && (
        <div className="banner mt-4 border-error/40 bg-error/10">
          ⚠️ <b>NO STOP</b> — some positions have no broker-side stop-loss. Fix before they run unprotected.
        </div>
      )}
    </AppShell>
  );
}
