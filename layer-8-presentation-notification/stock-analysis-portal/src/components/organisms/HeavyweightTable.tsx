// @ts-nocheck
export default function HeavyweightTable({ stocks = [] }) {
  const defaults = [
    { name: 'HDFC Bank', weight: '13.1%', move: '+1.42%', points: '+18.2', dir: '↑ leading' },
    { name: 'ICICI Bank', weight: '8.4%', move: '+1.10%', points: '+12.4', dir: '↑' },
    { name: 'Reliance', weight: '9.7%', move: '+0.62%', points: '+9.1', dir: '↑' },
    { name: 'Infosys', weight: '5.6%', move: '−0.58%', points: '−4.6', dir: '↓ lagging' },
    { name: 'TCS', weight: '4.1%', move: '—', points: '—', dir: 'stale feed' },
  ];
  const items = stocks.length ? stocks : defaults;

  const dirBadge = (d) => {
    if (d.includes('↑') || d.includes('leading')) return 'badge badge-ok text-[10px] font-bold px-2 py-1 rounded-full border border-success/30 bg-success/15 text-success';
    if (d.includes('↓') || d.includes('lagging')) return 'badge badge-err text-[10px] font-bold px-2 py-1 rounded-full border border-error/30 bg-error/15 text-error';
    return 'badge badge-neutral text-[10px] font-bold px-2 py-1 rounded-full border border-border bg-surface-hover text-text-secondary';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Heavyweight contribution</h2>
        <span className="text-[11px] text-text-tertiary">weight × %move → NIFTY points</span>
      </div>
      <div className="overflow-x-auto border border-border rounded-xl">
        <table className="w-full min-w-[540px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-tertiary">
              <th className="text-left px-3 py-2 bg-surface-hover font-bold">Stock</th>
              <th className="text-right px-3 py-2 bg-surface-hover font-bold tabular-nums">Weight</th>
              <th className="text-right px-3 py-2 bg-surface-hover font-bold tabular-nums">%move</th>
              <th className="text-right px-3 py-2 bg-surface-hover font-bold tabular-nums">Points</th>
              <th className="text-left px-3 py-2 bg-surface-hover font-bold">Direction</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s, i) => {
              const isPos = s.move.startsWith('+');
              const isNeg = s.move.startsWith('−');
              return (
                <tr key={i} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2.5 text-sm">{s.name}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{s.weight}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${isPos ? 'text-success' : isNeg ? 'text-error' : ''}`}>{s.move}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${s.points.startsWith('+') ? 'text-success' : s.points.startsWith('−') ? 'text-error' : 'text-text-tertiary'}`}>{s.points}</td>
                  <td className="px-3 py-2.5"><span className={dirBadge(s.dir)}>{s.dir}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
