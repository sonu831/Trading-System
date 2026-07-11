// @ts-nocheck
export default function AlertFeed({ alerts = [] }) {
  const defaults = [
    { id: 1, sev: 'error', text: 'NO STOP', detail: 'resting SL-M failed on BANKNIFTY 54000 PE.', sub: 'Position unprotected · action required', time: '09:40 IST' },
    { id: 2, sev: 'warn', text: 'Feed switch', detail: 'Kite feed stale >1.5s, failed over to FlatTrade.', sub: 'Divergence guard OK', time: '09:31 IST' },
    { id: 3, sev: 'ok', text: 'Fill', detail: 'bought NIFTY 24850 CE @ ₹142.50 (2 lots).', sub: 'momentum-burst · T1', time: '09:24 IST' },
    { id: 4, sev: 'info', text: 'Breadth-reversal exit', detail: 'A/D flipped, closed intraday runner in profit.', sub: '+22% premium', time: '09:19 IST' },
  ];
  const items = alerts.length ? alerts : defaults;

  const dotColor = (s) => {
    const map = { error: 'bg-error', warn: 'bg-warning', ok: 'bg-success', info: 'bg-info' };
    return map[s] || 'bg-border';
  };

  return (
    <div className="card">
      {items.map((a) => (
        <div key={a.id} className="flex gap-3 items-start py-3 border-b border-border last:border-b-0">
          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor(a.sev)}`} />
          <div className="flex-1 min-w-0">
            <b>{a.text}</b> — {a.detail}
            <div className="text-[11px] text-text-tertiary">{a.sub}</div>
          </div>
          <span className="text-xs text-text-tertiary tabular-nums shrink-0">{a.time}</span>
        </div>
      ))}
    </div>
  );
}
