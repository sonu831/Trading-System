// @ts-nocheck
import React from 'react';
import Head from 'next/head';
import AppShell from '@/components/layout/AppShell/AppShell';
import SwarmMonitor from '@/components/features/BackfillManager/SwarmMonitor';

const SMonitor = SwarmMonitor;

export default function SwarmPage() {
  return (
    <AppShell>
      <Head>
        <title>Swarm Monitor | Trading System</title>
        <meta name="description" content="Live Monitoring of Swarm Backfill Jobs" />
      </Head>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">🐝 Swarm Monitor</h1>
        <span className="text-sm text-text-tertiary">Real-time visibility into distributed backfill workers.</span>
      </div>
      <SMonitor showEmpty={true} />
    </AppShell>
  );
}
