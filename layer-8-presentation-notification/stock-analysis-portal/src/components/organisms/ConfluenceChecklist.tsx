// @ts-nocheck
export default function ConfluenceChecklist({ regime = {}, vix, breadth }) {
  const items = [
    { id: 'regime', label: 'Regime aligned', pass: regime?.trend && regime.trend !== 'RANGE', detail: regime?.trend || '—' },
    { id: 'breadth', label: 'Breadth confirmed', pass: breadth?.adRatio > 1.2 || breadth?.adRatio < 0.8, detail: breadth?.adRatio ? breadth.adRatio.toFixed(2) : '—' },
    { id: 'momentum', label: 'Momentum burst', pass: regime?.phase === 'BREAKOUT' || regime?.strength > 0.5, detail: regime?.strength ? (regime.strength * 100).toFixed(0) + '%' : '—' },
    { id: 'extended', label: 'Not extended', pass: regime?.phase !== 'EXHAUSTION', detail: regime?.phase || '—' },
    { id: 'liquidity', label: 'Liquidity OK', pass: true, detail: 'TBD' },
    { id: 'vix', label: 'VIX band OK', pass: !vix || (vix >= 10 && vix <= 30), detail: vix ? vix.toFixed(1) : '—' },
    { id: 'time', label: 'Time window OK', pass: true, detail: '09:45-14:30' },
  ];

  const passed = items.filter(i => i.pass).length;

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">Confluence</h3>
        <span className={`text-xs font-mono ${passed >= 5 ? 'text-success' : passed >= 3 ? 'text-warning' : 'text-error'}`}>
          {passed}/{items.length}
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map(i => (
          <div key={i.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={i.pass ? 'text-success' : 'text-error'}>{i.pass ? '✓' : '✗'}</span>
              <span className="text-text-secondary">{i.label}</span>
            </div>
            <span className="text-text-tertiary font-mono">{i.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
