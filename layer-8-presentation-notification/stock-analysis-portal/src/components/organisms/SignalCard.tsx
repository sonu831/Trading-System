// @ts-nocheck
export default function SignalCard({ signals = [] }) {
  if (signals.length === 0) {
    return (
      <div className="card text-center py-10 text-text-tertiary">— No active signals</div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {signals.map((s) => {
        const bg = s.tone === 'pos' ? 'bg-success/15 text-success'
                  : s.tone === 'neg' ? 'bg-error/15 text-error'
                  : 'bg-surface-hover text-text-secondary';
        return (
          <div key={s.id} className="card flex gap-3 items-start" style={{ opacity: s.tone === 'neutral' ? 0.7 : 1 }}>
            <span className={`text-sm font-extrabold px-2.5 py-1.5 rounded-lg shrink-0 ${bg}`}>{s.dir}</span>
            <div className="flex-1 min-w-0">
              <b>{s.strategy}</b> · <span className="text-text-tertiary">{s.tier}</span> · <span className="tabular-nums text-sm">{s.strike}</span>
              {s.reasons?.length > 0 ? (
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {s.reasons.map((r, i) => (
                    <span key={i} className="text-[11px] text-text-secondary bg-surface-hover rounded-full px-2 py-0.5">{r}</span>
                  ))}
                </div>
              ) : null}
            </div>
            {s.time ? <span className="text-xs text-text-tertiary tabular-nums shrink-0">{s.time}</span> : null}
          </div>
        );
      })}
    </div>
  );
}
