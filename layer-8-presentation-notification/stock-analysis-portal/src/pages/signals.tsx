// @ts-nocheck
import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell/AppShell';
import SignalCard from '@/components/organisms/SignalCard';

export default function SignalsPage() {
  const [filter, setFilter] = useState('All');
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/v1/signals');
        const data = await res.json();
        if (data.success && data.data) {
          setSignals(data.data.map((s, i) => ({
            id: s.id || i,
            dir: s.action === 'BUY' ? 'BUY CE' : s.action === 'SELL' ? 'BUY PE' : 'NO TRADE',
            strategy: s.strategy || '—',
            tier: s.tier || '—',
            strike: s.price ? `₹${s.price}` : '—',
            time: s.timestamp ? new Date(s.timestamp).toLocaleTimeString() : '—',
            reasons: [s.reason || `confidence: ${s.confidence || '—'}`],
            tone: s.action === 'BUY' ? 'pos' : s.action === 'SELL' ? 'neg' : 'neutral',
          })));
        }
      } catch (_) {}
      setLoading(false);
    };
    fetchSignals();
    const id = setInterval(fetchSignals, 5000);
    return () => clearInterval(id);
  }, []);

  const filtered = filter === 'All' ? signals : signals.filter(s => s.tier?.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Signals</h1>
        <span className="text-sm text-text-tertiary">{signals.length} trade-signals · tagged tier, strategy &amp; reasons</span>
        <div className="ml-auto flex border border-border rounded-lg p-0.5 gap-0.5 bg-surface">
          {['All', 'Scalp', 'Positional'].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border-none cursor-pointer ${filter === f ? 'bg-primary text-white' : 'text-text-secondary'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="card text-center py-10 text-text-tertiary">Loading signals...</div>
      ) : (
        <SignalCard signals={filtered} />
      )}
    </AppShell>
  );
}
