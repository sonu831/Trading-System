import React from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import AdvanceDeclineBar from '@/components/organisms/AdvanceDeclineBar';
import SectorRotation from '@/components/organisms/SectorRotation';
import HeavyweightTable from '@/components/organisms/HeavyweightTable';

export default function InternalsPage() {
  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Market Internals</h1>
        <span className="text-sm text-text-tertiary">Derive the index from its 50 constituents — is this move real or fake?</span>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <AdvanceDeclineBar />
        <SectorRotation />
      </div>
      <div className="mt-4">
        <HeavyweightTable />
      </div>
    </AppShell>
  );
}
