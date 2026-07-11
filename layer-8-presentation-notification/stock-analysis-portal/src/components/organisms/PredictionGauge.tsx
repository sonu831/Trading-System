// @ts-nocheck
export default function PredictionGauge({ pct = 64, label = 'prob. UP', direction = 'UP', confidence = 0.70, model = 'lstm-breadth v0.3', horizon = 'SCALP · 1–5m' }) {
  const circumference = 314; // 2 * π * 50
  const offset = circumference - (circumference * pct / 100);
  const isUp = direction === 'UP';
  const tone = isUp ? 'var(--color-success)' : 'var(--color-error)';

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Next NIFTY move</h2>
        <span className="badge badge-neutral text-xs font-bold px-2.5 py-1 rounded-full border border-border bg-surface-hover text-text-secondary">{horizon}</span>
      </div>
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative w-[150px] h-[150px] shrink-0">
          <svg viewBox="0 0 120 120" width="150" height="150">
            <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-surface-hover)" strokeWidth="12" />
            <circle cx="60" cy="60" r="50" fill="none" stroke={tone} strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 60 60)" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-[30px] font-extrabold tracking-tight ${isUp ? 'text-success' : 'text-error'}`}>{pct}%</span>
            <span className="text-[11px] text-text-tertiary uppercase tracking-wider">{label}</span>
          </div>
        </div>
        <div>
          <div className="kv"><span className="text-text-secondary">Direction</span><span className={`font-semibold tabular-nums ${isUp ? 'text-success' : 'text-error'}`}>{direction}</span></div>
          <div className="kv"><span className="text-text-secondary">Expected move</span><span className="font-semibold tabular-nums">+0.4% · ~28 pts</span></div>
          <div className="kv"><span className="text-text-secondary">Confidence</span><span className="font-semibold tabular-nums">{confidence.toFixed(2)}</span></div>
          <div className="kv"><span className="text-text-secondary">Model</span><span className="text-xs text-text-tertiary">{model}</span></div>
          <div className="kv"><span className="text-text-secondary">Updated</span><span className="text-xs text-text-tertiary">4s ago</span></div>
        </div>
      </div>
      <div className="text-xs text-text-tertiary mt-3">A model score never fires a trade alone — it raises or lowers conviction &amp; sizing on top of the breadth-confirmed momentum trigger.</div>
    </div>
  );
}
