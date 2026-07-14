import { useIndexQuote } from '@/hooks/useMarket';

/** Shows NIFTY / BANKNIFTY spot in the safety bar. Polls L7 every 3s via useIndexQuote. */
export default function IndexTicker() {
  const nifty = useIndexQuote('NIFTY');
  const banknifty = useIndexQuote('BANKNIFTY');

  const fmtPrice = (v: number | undefined | null) =>
    v != null ? v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

  const fmtChange = (v: number | undefined | null) => {
    if (v == null) return '—';
    const sign = v >= 0 ? '+' : '';
    return `${sign}${v.toFixed(2)}%`;
  };

  const changeTone = (v: number | undefined | null) => {
    if (v == null) return 'text-text-tertiary';
    return v >= 0 ? 'text-success' : 'text-error';
  };

  return (
    <div className="flex items-center gap-3 ml-4 text-xs">
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">NIFTY</span>
        <span className="font-bold text-sm tabular-nums">
          {fmtPrice(nifty?.ltp)} <span className={changeTone(nifty?.changePct)}>{fmtChange(nifty?.changePct)}</span>
        </span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wider text-text-tertiary">BANKNIFTY</span>
        <span className="font-bold text-sm tabular-nums">
          {fmtPrice(banknifty?.ltp)} <span className={changeTone(banknifty?.changePct)}>{fmtChange(banknifty?.changePct)}</span>
        </span>
      </div>
    </div>
  );
}
