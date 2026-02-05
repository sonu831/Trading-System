import React from 'react';
import Head from 'next/head';
import { AppLayout } from '@/components/layout';
import SwarmMonitor from '@/components/features/BackfillManager/SwarmMonitor';
import { useDashboard } from '@/hooks';

/**
 * Dedicated Swarm Monitor Page
 * /swarm
 */
export default function SwarmPage() {
  const { systemStatus, viewMode, setViewMode } = useDashboard();

  return (
    <>
      <Head>
        <title>Swarm Monitor | Trading System</title>
        <meta name="description" content="Live Monitoring of Swarm Backfill Jobs" />
      </Head>

      <AppLayout viewMode={viewMode} setViewMode={setViewMode} systemStatus={systemStatus}>
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3">
              🐝 Swarm Monitor
            </h1>
            <p className="text-text-secondary mt-2">
              Real-time visibility into distributed backfill workers.
            </p>
          </div>

          {/* The Monitor Component with Empty State enabled */}
          <SwarmMonitor showEmpty={true} />
        </div>
      </AppLayout>
    </>
  );
}
