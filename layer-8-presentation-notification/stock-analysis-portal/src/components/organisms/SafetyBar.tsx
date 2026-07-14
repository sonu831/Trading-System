// @ts-nocheck
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import KillSwitchButton from '@/components/trading/KillSwitchButton';
import TradeModeBadge from '@/components/trading/TradeModeBadge';
import StaleBadge from '@/components/trading/StaleBadge';

const COUNTDOWN_ENTRY_CUTOFF = { h: 15, m: 0 };  // 15:00 IST
const COUNTDOWN_SQUAREOFF = { h: 15, m: 15 };     // 15:15 IST

function useSessionClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const toIST = (ts) => new Date(ts + 5.5 * 3600000);
  const ist = toIST(now);
  const h = ist.getUTCHours(), m = ist.getUTCMinutes();

  const minsTo = (targetH, targetM) => {
    const diff = (targetH * 60 + targetM) - (h * 60 + m);
    if (diff <= 0) { const nextDay = 24 * 60 + diff; return { expired: true, mins: 0, hh: 0, mm: 0 }; }
    return { expired: false, mins: diff, hh: Math.floor(diff / 60), mm: diff % 60 };
  };

  const cutoff = minsTo(COUNTDOWN_ENTRY_CUTOFF.h, COUNTDOWN_ENTRY_CUTOFF.m);
  const squareoff = minsTo(COUNTDOWN_SQUAREOFF.h, COUNTDOWN_SQUAREOFF.m);
  const isWeekend = ist.getUTCDay() === 0 || ist.getUTCDay() === 6;
  const marketOpen = ist.getUTCHours() >= 9 && ist.getUTCHours() < 15 && !isWeekend;

  return { cutoff, squareoff, marketOpen, now };
}

export default function SafetyBar({ underlying = 'NIFTY', spot, regimeUpdatedAt }) {
  const execState = useSelector((s) => s.execution || {});
  const clock = useSessionClock();
  const mode = execState?.mode || 'paper';

  const formatTime = (c) => c.expired ? '--:--' : `${String(c.hh).padStart(2, '0')}:${String(c.mm).padStart(2, '0')}`;

  return (
    <div className="sticky top-0 z-50 bg-surface border-b border-border px-4 py-2 flex items-center gap-3 flex-wrap shadow-lg">
      {/* Underlying */}
      <select className="bg-surface border border-border text-text-primary text-sm rounded px-2 py-1" defaultValue={underlying}>
        <option>NIFTY</option>
        <option>BANKNIFTY</option>
      </select>

      {/* Spot */}
      <span className="text-lg font-bold tabular-nums text-text-primary">
        {spot ? spot.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '—'}
      </span>

      <div className="flex-1" />

      {/* Mode */}
      <TradeModeBadge mode={mode} />

      {/* Regime staleness */}
      <StaleBadge timestamp={regimeUpdatedAt} />

      {/* Session clock */}
      {clock.marketOpen ? (
        <span className="text-xs text-warning font-mono tabular-nums">
          E: {formatTime(clock.cutoff)} · S: {formatTime(clock.squareoff)}
        </span>
      ) : (
        <span className="text-xs text-text-tertiary">Market closed</span>
      )}

      {/* Kill switch */}
      <KillSwitchButton />
    </div>
  );
}
