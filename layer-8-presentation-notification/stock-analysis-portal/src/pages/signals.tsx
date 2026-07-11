// @ts-nocheck
import { useState } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import SignalCard from '@/components/organisms/SignalCard';

export default function SignalsPage() {
  const [filter, setFilter] = useState('All');

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Signals</h1>
        <span className="text-sm text-text-tertiary">trade-signals feed — tagged tier, strategy &amp; reasons</span>
        <div className="ml-auto flex border border-border rounded-lg p-0.5 gap-0.5 bg-surface">
          {['All', 'Scalp', 'Positional'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${filter === f ? 'bg-primary text-white' : 'text-text-secondary'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <SignalCard />
    </AppShell>
  );
}
