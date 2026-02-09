import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { AppLayout } from '@/components/layout';
import DashboardView from '@/components/Dashboard';
import HistoricalView from '@/components/Historical';
import { EmptyState, PageHeader, ErrorBoundary } from '@/components/common';
import { useDashboard } from '@/hooks';
import { selectPipelineStatus } from '@/store/slices/systemSlice';
import { BackfillProgress, SwarmNotification } from '@/components/Backfill';

export default function Home() {
  const { marketView, signals, systemStatus, loading, viewMode, setViewMode } = useDashboard();

  const pipelineStatus = useSelector(selectPipelineStatus);
  const backfillData = pipelineStatus?.layers?.layer1?.backfill;
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (backfillData?.status === 'running') {
      setIsDismissed(false);
    }
  }, [backfillData?.status]);

  return (
    <AppLayout viewMode={viewMode} setViewMode={setViewMode} systemStatus={systemStatus}>
      {/* Global Swarm Notification */}
      <SwarmNotification />

      {/* Backfill Progress Indicator */}
      {backfillData &&
        (backfillData.status === 'running' ||
          (backfillData.status === 'completed' && !isDismissed)) && (
          <div className="mb-6">
            <BackfillProgress
              status={backfillData.status}
              progress={backfillData.progress}
              details={backfillData.details}
              onClose={() => setIsDismissed(true)}
            />
          </div>
        )}

      {viewMode === 'LIVE' ? (
        <DashboardView marketView={marketView} signals={signals} loading={loading} />
      ) : (
        <HistoricalView />
      )}
    </AppLayout>
  );
}
