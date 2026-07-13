// @ts-nocheck
export default function FeatureContributions({ features = [] }) {
  if (features.length === 0) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold">Why — top feature contributions</h2>
          <span className="text-[11px] text-text-tertiary">signed push toward the call</span>
        </div>
        <div className="flex items-center justify-center py-8 text-xs text-text-tertiary">— Feature data unavailable</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Why — top feature contributions</h2>
        <span className="text-[11px] text-text-tertiary">signed push toward the call</span>
      </div>
      {features.map((f, i) => {
        const absVal = Math.abs(f.value);
        const width = Math.round(absVal * 40);
        const isPos = (f.tone || (f.value >= 0 ? 'pos' : 'neg')) === 'pos';
        const color = isPos ? 'var(--color-success)' : 'var(--color-error)';
        return (
          <div key={i} className="flex items-center gap-3 my-2 text-xs">
            <span className="w-[120px] text-text-secondary shrink-0">{f.label}</span>
            <div className="flex-1 h-4 bg-surface-hover rounded-lg relative overflow-hidden">
              <span className={`absolute top-0 h-full rounded-lg ${isPos ? 'left-1/2' : 'right-1/2'}`}
                style={{ width: `${width}%`, background: color, [isPos ? 'left' : 'right']: '50%' }} />
            </div>
            <span className={`w-[42px] text-right tabular-nums font-semibold shrink-0 ${isPos ? 'text-success' : 'text-error'}`}>
              {isPos ? '+' : '−'}{absVal.toFixed(1)}
            </span>
          </div>
        );
      })}
      <div className="banner mt-3 text-xs p-3 rounded-xl border border-warning/40 bg-warning/10">
        ℹ️ On stale or missing features the model <b>abstains</b> — it shows <span className="text-text-tertiary">—</span>, never a fabricated 0.
      </div>
    </div>
  );
}
