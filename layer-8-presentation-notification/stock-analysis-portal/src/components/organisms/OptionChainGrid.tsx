// @ts-nocheck
import { useState, useEffect } from 'react';
import { useExpiries, useOptionChain } from '@/hooks/useMarket';

function formatNum(n, decimals = 2) { return n != null ? Number(n).toFixed(decimals) : '—'; }
function spreadPct(ask, bid) { return (ask && bid && ask > 0) ? ((ask - bid) / ask * 100).toFixed(1) + '%' : '—'; }

export default function OptionChainGrid({ underlying = 'NIFTY' }) {
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const expiries = useExpiries(underlying);
  const { rows, spot, atm } = useOptionChain(underlying, selectedExpiry);

  useEffect(() => { if (expiries.length && !selectedExpiry) setSelectedExpiry(expiries[0]?.date); }, [expiries]);

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary">Option Chain</span>
          <span className="text-xs text-text-tertiary">
            Spot: <span className="text-text-primary tabular-nums">{spot || '—'}</span>
            {atm > 0 && <span className="ml-2">ATM: <span className="text-warning">{atm}</span></span>}
          </span>
        </div>
        <select value={selectedExpiry} onChange={e => setSelectedExpiry(e.target.value)}
          className="bg-surface border border-border text-text-primary text-xs rounded px-2 py-1">
          {expiries.map(e => <option key={e.date} value={e.date}>{e.date} ({e.dte}d {e.type})</option>)}
        </select>
      </div>

      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface z-10">
            <tr className="border-b border-border">
              <th colSpan={5} className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary border-r border-border">CALLS</th>
              <th className="px-2 py-1.5 text-center text-xs font-medium text-text-primary border-r border-border">STRIKE</th>
              <th colSpan={5} className="px-2 py-1.5 text-left text-xs font-medium text-text-tertiary">PUTS</th>
            </tr>
            <tr className="border-b border-border text-text-tertiary">
              <th className="px-1.5 py-1 text-right w-16">LTP</th>
              <th className="px-1.5 py-1 text-right w-12">Bid</th>
              <th className="px-1.5 py-1 text-right w-12">Ask</th>
              <th className="px-1.5 py-1 text-right w-10">Spread</th>
              <th className="px-1.5 py-1 text-right w-16 border-r border-border">OI</th>
              <th className="px-2 py-1 text-center border-r border-border"></th>
              <th className="px-1.5 py-1 text-right w-16">OI</th>
              <th className="px-1.5 py-1 text-right w-10">Spread</th>
              <th className="px-1.5 py-1 text-right w-12">Bid</th>
              <th className="px-1.5 py-1 text-right w-12">Ask</th>
              <th className="px-1.5 py-1 text-left w-16">LTP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.strike || i}
                className={`border-b border-border/30 hover:bg-surface-hover transition-colors ${r.isATM ? 'bg-primary/5' : ''}`}>
                {/* CE side */}
                <td className={`px-1.5 py-1 text-right tabular-nums ${r.isATM ? 'font-semibold' : ''}`}>
                  {r.ce ? <span className="text-text-primary">{formatNum(r.ce.ltp)}</span> : <span className="text-text-tertiary">—</span>}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums text-text-tertiary">{r.ce ? formatNum(r.ce.bid) : '—'}</td>
                <td className="px-1.5 py-1 text-right tabular-nums text-text-tertiary">{r.ce ? formatNum(r.ce.ask) : '—'}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {r.ce ? <span className={r.ce.ask - r.ce.bid > r.ce.ltp * 0.1 ? 'text-error' : 'text-success'}>{spreadPct(r.ce.ask, r.ce.bid)}</span> : '—'}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums text-text-secondary border-r border-border/30">{r.ce ? r.ce.oi.toLocaleString() : '—'}</td>

                {/* Strike */}
                <td className={`px-2 py-1 text-center font-mono tabular-nums border-r border-border/30 ${r.isATM ? 'text-warning font-bold text-sm' : 'text-text-primary'}`}>
                  {r.strike}
                </td>

                {/* PE side */}
                <td className="px-1.5 py-1 text-right tabular-nums text-text-secondary">{r.pe ? r.pe.oi.toLocaleString() : '—'}</td>
                <td className="px-1.5 py-1 text-right tabular-nums">
                  {r.pe ? <span className={r.pe.ask - r.pe.bid > r.pe.ltp * 0.1 ? 'text-error' : 'text-success'}>{spreadPct(r.pe.ask, r.pe.bid)}</span> : '—'}
                </td>
                <td className="px-1.5 py-1 text-right tabular-nums text-text-tertiary">{r.pe ? formatNum(r.pe.bid) : '—'}</td>
                <td className="px-1.5 py-1 text-right tabular-nums text-text-tertiary">{r.pe ? formatNum(r.pe.ask) : '—'}</td>
                <td className={`px-1.5 py-1 text-left tabular-nums ${r.isATM ? 'font-semibold' : ''}`}>
                  {r.pe ? <span className="text-text-primary">{formatNum(r.pe.ltp)}</span> : <span className="text-text-tertiary">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            No option chain data available yet. Data flows when ingestion + option-chain consumer are running.
          </div>
        )}
      </div>
    </div>
  );
}
