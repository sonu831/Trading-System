// @ts-nocheck
export default function EngineIntentCard({ symbol = null, premium = null, delta = null, stopPct = null, stopPrice = null, targetPct = null, targetPrice = null, mode = null, checks = null }) {
  if (!symbol || !premium || !mode) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold">Engine Intent</h2>
          <span className="badge badge-accent text-xs font-bold px-2.5 py-1 rounded-full border border-accent/30 bg-accent/15 text-accent">PREVIEW</span>
        </div>
        <div className="flex items-center justify-center py-8 text-xs text-text-tertiary">— No intent data · engine idle</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Engine Intent</h2>
        <span className="badge badge-accent text-xs font-bold px-2.5 py-1 rounded-full border border-accent/30 bg-accent/15 text-accent">PREVIEW</span>
      </div>
      <div className="kv"><span className="text-text-secondary text-xs">Buy</span><span className="font-semibold text-sm tabular-nums">{symbol}</span></div>
      <div className="kv"><span className="text-text-secondary text-xs">Premium</span><span className="font-semibold text-sm tabular-nums">₹{premium}</span></div>
      {delta !== null ? <div className="kv"><span className="text-text-secondary text-xs">Delta</span><span className="font-semibold text-sm tabular-nums">{delta}</span></div> : null}
      <div className="kv"><span className="text-text-secondary text-xs">Stop</span><span className="text-error font-semibold text-sm">{stopPct || '—'} · ₹{stopPrice || '—'}</span></div>
      <div className="kv"><span className="text-text-secondary text-xs">Target</span><span className="text-success font-semibold text-sm">{targetPct || '—'} · ₹{targetPrice || '—'}</span></div>
      <button className="btn-primary w-full justify-center mt-3 text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-br from-primary to-accent text-white border-none cursor-pointer hover:-translate-y-0.5 transition">
        Arm entry ({mode})
      </button>
      {checks && checks.length > 0 ? (
        <div className="flex gap-2 mt-3 flex-wrap">
          {checks.map((c, i) => (
            <span key={i} className="badge badge-ok text-[10px] font-bold px-2 py-1 rounded-full border border-success/30 bg-success/15 text-success">{c}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
