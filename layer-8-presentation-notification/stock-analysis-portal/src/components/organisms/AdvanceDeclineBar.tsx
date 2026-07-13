// @ts-nocheck
import StaleBadge from '@/components/trading/StaleBadge';

export default function AdvanceDeclineBar({ advancing = null, declining = null, aboveVwap = null, aboveEma20 = null, adRatio = null, breadth = null }) {
  const total = advancing !== null && declining !== null ? advancing + declining : 0;
  const upPct = total > 0 ? Math.round((advancing / total) * 100) : 50;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold">Market breadth — advance / decline</h2>
        {breadth ? (
          <span className="badge badge-ok text-xs font-bold px-2.5 py-1 rounded-full border border-success/30 bg-success/15 text-success">{breadth}</span>
        ) : (
          <StaleBadge />
        )}
      </div>
      {advancing === null || declining === null ? (
        <div className="flex items-center justify-center h-7 rounded-lg bg-surface-hover text-xs text-text-tertiary">— Waiting for breadth data</div>
      ) : (
        <div className="flex h-7 rounded-lg overflow-hidden text-xs font-bold text-white">
          <div className="bg-success flex items-center px-2" style={{ width: `${upPct}%` }}>{advancing} advancing · {upPct}%</div>
          <div className="bg-error flex items-center justify-end px-2" style={{ width: `${100 - upPct}%` }}>{declining}</div>
        </div>
      )}
      <div className="flex gap-6 mt-3">
        <StatBadge label="% above VWAP" value={aboveVwap !== null ? `${aboveVwap}%` : '—'} />
        <StatBadge label="% above EMA20" value={aboveEma20 !== null ? `${aboveEma20}%` : '—'} />
        <StatBadge label="A/D ratio" value={adRatio !== null ? adRatio.toFixed(2) : '—'} />
        <StatBadge label="Thrust" value={'—'} />
      </div>
    </div>
  );
}

function StatBadge({ label, value, tone = '' }) {
  const color = tone === 'pos' ? 'text-success' : '';
  return (
    <div>
      <div className="text-[11px] text-text-tertiary">{label}</div>
      <div className={`tabular-nums text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}
