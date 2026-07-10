import { useSelector } from 'react-redux';
import AppLayout from '@/components/layout/AppLayout/AppLayout';
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
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-text-primary">Positions</h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Day P&L" value={dayPnl} />
          <StatTile label="Open Positions" value={openPositions.length} />
          <StatTile label="Mode" value={execState?.mode || 'paper'} />
          <DailyRiskCard />
        </div>

        {openPositions.length > 0 ? (
          <PositionsTable positions={openPositions} />
        ) : (
          <div className="bg-surface border border-border rounded-xl p-8 text-center text-text-tertiary">
            No open positions — signals will appear here when the strategy triggers
          </div>
        )}
      </div>
    </AppLayout>
  );
}
