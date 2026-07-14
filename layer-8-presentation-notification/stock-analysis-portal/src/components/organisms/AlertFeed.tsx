// @ts-nocheck
export default function AlertFeed({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div className="card text-center py-10 text-text-tertiary">— No alerts</div>
    );
  }

  const dotColor = (s) => {
    const map = { error: 'bg-error', warn: 'bg-warning', ok: 'bg-success', info: 'bg-info' };
    return map[s] || 'bg-border';
  };

  return (
    <div className="card">
      {alerts.map((a) => (
        <div key={a.id} className="flex gap-3 items-start py-3 border-b border-border last:border-b-0">
          <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${dotColor(a.sev)}`} />
          <div className="flex-1 min-w-0">
            <b>{a.text}</b> — {a.detail}
            {a.sub ? <div className="text-[11px] text-text-tertiary">{a.sub}</div> : null}
          </div>
          {a.time ? <span className="text-xs text-text-tertiary tabular-nums shrink-0">{a.time}</span> : null}
        </div>
      ))}
    </div>
  );
}
