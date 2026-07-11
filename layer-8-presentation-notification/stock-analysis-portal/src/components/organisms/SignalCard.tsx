// @ts-nocheck
export default function SignalCard({ signals = [] }) {
  const defaults = [
    { id: 1, dir: 'BUY CE', strategy: 'momentum-burst', tier: 'T1 scalp', strike: '24,850 CE', time: '09:38:14', reasons: ['regime TREND_UP', 'A/D 3.17', 'burst 1.6× ATR', 'pred UP 64%', 'not extended'], tone: 'pos' },
    { id: 2, dir: 'BUY PE', strategy: 'trend-pullback', tier: 'T2 intraday', strike: '54,000 PE', time: '09:22:41', reasons: ['BANKNIFTY lagging', 'pullback to VWAP', 'pred DOWN 58%'], tone: 'neg' },
    { id: 3, dir: 'NO TRADE', strategy: 'chop guard', tier: '—', strike: '—', time: '09:15:02', reasons: ['A/D 1.1', 'VIX spike', 'first 5 min skip'], tone: 'neutral' },
  ];
  const items = signals.length ? signals : defaults;

  return (
    <div className="flex flex-col gap-3">
      {items.map((s) => {
        const bg = s.tone === 'pos' ? 'bg-success/15 text-success'
                  : s.tone === 'neg' ? 'bg-error/15 text-error'
                  : 'bg-surface-hover text-text-secondary';
        return (
          <div key={s.id} className="card flex gap-3 items-start" style={{ opacity: s.tone === 'neutral' ? 0.7 : 1 }}>
            <span className={`text-sm font-extrabold px-2.5 py-1.5 rounded-lg shrink-0 ${bg}`}>{s.dir}</span>
            <div className="flex-1 min-w-0">
              <b>{s.strategy}</b> · <span className="text-text-tertiary">{s.tier}</span> · <span className="tabular-nums text-sm">{s.strike}</span>
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {s.reasons.map((r, i) => (
                  <span key={i} className="text-[11px] text-text-secondary bg-surface-hover rounded-full px-2 py-0.5">{r}</span>
                ))}
              </div>
            </div>
            <span className="text-xs text-text-tertiary tabular-nums shrink-0">{s.time}</span>
          </div>
        );
      })}
    </div>
  );
}
