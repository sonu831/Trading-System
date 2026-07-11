// @ts-nocheck
export default function EngineIntentCard({ symbol = '24,850 CE', premium = '168.30', delta = 0.58, stopPct = '−18%', stopPrice = '138', targetPct = '+30%', targetPrice = '219', mode = 'PAPER', checks = ['UP 64%', 'Breadth ✓', 'T1 open'] }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Engine Intent</h2>
        <span className="badge badge-accent text-xs font-bold px-2.5 py-1 rounded-full border border-accent/30 bg-accent/15 text-accent">PREVIEW</span>
      </div>
      <div className="kv"><span className="text-text-secondary text-xs">Buy</span><span className="font-semibold text-sm tabular-nums">{symbol}</span></div>
      <div className="kv"><span className="text-text-secondary text-xs">Premium</span><span className="font-semibold text-sm tabular-nums">₹{premium}</span></div>
      <div className="kv"><span className="text-text-secondary text-xs">Delta</span><span className="font-semibold text-sm tabular-nums">{delta}</span></div>
      <div className="kv"><span className="text-text-secondary text-xs">Stop</span><span className="text-error font-semibold text-sm">{stopPct} · ₹{stopPrice}</span></div>
      <div className="kv"><span className="text-text-secondary text-xs">Target</span><span className="text-success font-semibold text-sm">{targetPct} · ₹{targetPrice}</span></div>
      <button className="btn-primary w-full justify-center mt-3 text-sm font-semibold px-4 py-2 rounded-lg bg-gradient-to-br from-primary to-accent text-white border-none cursor-pointer hover:-translate-y-0.5 transition">
        Arm entry ({mode})
      </button>
      <div className="flex gap-2 mt-3 flex-wrap">
        {checks.map((c, i) => (
          <span key={i} className="badge badge-ok text-[10px] font-bold px-2 py-1 rounded-full border border-success/30 bg-success/15 text-success">{c}</span>
        ))}
      </div>
    </div>
  );
}
