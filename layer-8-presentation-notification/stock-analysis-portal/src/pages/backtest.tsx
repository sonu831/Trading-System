// @ts-nocheck
import AppShell from '@/components/layout/AppShell/AppShell';

export default function BacktestLabPage() {
  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Backtest Lab</h1>
        <span className="text-sm text-text-tertiary">Validate the edge before it touches live sizing</span>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div className="card">
          <h2 className="text-sm font-bold mb-3">Run</h2>
          <div className="kv"><span className="text-text-secondary text-xs">Strategy</span><span className="font-semibold text-sm">momentum-burst</span></div>
          <div className="kv"><span className="text-text-secondary text-xs">Range</span><span className="font-semibold text-sm">2026-04 → 07</span></div>
          <div className="kv"><span className="text-text-secondary text-xs">Capital</span><span className="font-semibold text-sm tabular-nums">₹1,00,000</span></div>
          <div className="kv"><span className="text-text-secondary text-xs">Regime bucket</span><span className="font-semibold text-sm">TREND_UP</span></div>
          <button className="btn-primary w-full justify-center mt-3 text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-br from-primary to-accent text-white border-none cursor-pointer hover:-translate-y-0.5 transition">
            Run backtest
          </button>
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold">Result</h2>
            <span className="badge badge-ok text-xs font-bold px-2.5 py-1 rounded-full border border-success/30 bg-success/15 text-success">PASS · pf 1.42</span>
          </div>
          <svg className="w-full h-[120px]" viewBox="0 0 320 90" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-primary)" stopOpacity="0.25" /><stop offset="1" stopColor="var(--color-primary)" stopOpacity="0" /></linearGradient></defs>
            <polygon fill="url(#eq)" points="0,80 60,72 120,74 180,54 240,44 300,26 320,20 320,90 0,90" />
            <polyline fill="none" stroke="var(--color-primary)" strokeWidth="2" points="0,80 60,72 120,74 180,54 240,44 300,26 320,20" />
          </svg>
          <div className="flex gap-5 mt-3 flex-wrap">
            <div><div className="text-[11px] text-text-tertiary">Expectancy</div><div className="tabular-nums text-success font-bold">+0.34R</div></div>
            <div><div className="text-[11px] text-text-tertiary">Trades</div><div className="tabular-nums font-bold">142</div></div>
            <div><div className="text-[11px] text-text-tertiary">Max DD</div><div className="tabular-nums text-error font-bold">−8.2%</div></div>
            <div><div className="text-[11px] text-text-tertiary">Promotion</div><span className="badge badge-warn text-xs font-bold px-2 py-1 rounded-full border border-warning/30 bg-warning/15 text-warning">HUMAN-GATED</span></div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
