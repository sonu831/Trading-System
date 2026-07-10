import React from 'react';
import PropTypes from 'prop-types';
import { ShieldCheck, ShieldAlert, TrendingUp, TrendingDown } from 'lucide-react';
import {
  EMPTY,
  formatCurrency,
  formatSignedCurrency,
  formatSignedPct,
  formatLots,
  minutesSince,
  pnlDirection,
} from '@/utils/format';

/**
 * Open-position book.
 *
 * Design notes:
 *  - Numeric columns use `tabular-nums` so digits align down the column.
 *  - P&L shows an explicit sign AND an arrow icon — colour is never the only cue.
 *  - "SL: none" is rendered LOUDLY. The 2026-07-09 audit found positions that had no
 *    broker-side stop at all; a position without a stop must be impossible to miss.
 *  - Unknown values are an em-dash, never a confident 0.
 */

function StopCell({ position }) {
  const hasStop = Number.isFinite(position.stopLoss) && position.stopLoss > 0;
  const restingAtBroker = Boolean(position.slOrderId);

  if (!hasStop) {
    return (
      <span className="inline-flex items-center gap-1.5 text-error font-bold">
        <ShieldAlert size={14} aria-hidden="true" />
        NO STOP
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5 text-text-primary tabular-nums">
        <ShieldCheck
          size={14}
          aria-hidden="true"
          className={restingAtBroker ? 'text-success' : 'text-warning'}
        />
        {formatCurrency(position.stopLoss)}
      </span>
      <span className={`text-[11px] ${restingAtBroker ? 'text-text-tertiary' : 'text-warning'}`}>
        {restingAtBroker ? 'resting at broker' : 'app-side only'}
      </span>
      {position.trailingActive ? (
        <span className="text-[11px] text-info">trailing active</span>
      ) : null}
    </span>
  );
}

StopCell.propTypes = { position: PropTypes.object.isRequired };

function PnlCell({ pnl, pnlPct }) {
  const dir = pnlDirection(pnl);
  if (dir === null) return <span className="text-text-tertiary">{EMPTY}</span>;

  const tone = dir === 'up' ? 'text-success' : dir === 'down' ? 'text-error' : 'text-text-secondary';
  const Icon = dir === 'up' ? TrendingUp : dir === 'down' ? TrendingDown : null;

  return (
    <span className={`inline-flex flex-col items-end ${tone}`}>
      <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
        {Icon ? <Icon size={13} aria-hidden="true" /> : null}
        {formatSignedCurrency(pnl)}
      </span>
      <span className="text-[11px] tabular-nums opacity-90">{formatSignedPct(pnlPct)}</span>
    </span>
  );
}

PnlCell.propTypes = { pnl: PropTypes.number, pnlPct: PropTypes.number };

function AgeCell({ position }) {
  const mins = minutesSince(position.entryTime);
  if (mins === null) return <span className="text-text-tertiary">{EMPTY}</span>;
  const limit = position.params?.timeStopMinutes;
  const nearTimeStop = Number.isFinite(limit) && mins >= limit * 0.8;

  return (
    <span className={`tabular-nums ${nearTimeStop ? 'text-warning font-semibold' : 'text-text-secondary'}`}>
      {mins}m{Number.isFinite(limit) ? <span className="text-text-tertiary"> / {limit}m</span> : null}
    </span>
  );
}

AgeCell.propTypes = { position: PropTypes.object.isRequired };

export default function PositionsTable({ positions, loading, reachable }) {
  if (reachable === false) {
    return (
      <div className="text-center py-10 text-text-tertiary">
        Execution engine unreachable — position book unavailable.
      </div>
    );
  }

  if (loading && positions.length === 0) {
    return <div className="text-center py-10 text-text-tertiary">Loading positions…</div>;
  }

  if (positions.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-text-secondary">No open positions.</p>
        <p className="text-text-tertiary text-xs mt-1">
          Entries appear here the moment a signal passes the risk gate and fills.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-text-tertiary text-xs uppercase tracking-wider border-b border-border">
            <th className="py-3 pr-4 font-medium">Contract</th>
            <th className="py-3 pr-4 font-medium">Strategy</th>
            <th className="py-3 pr-4 font-medium">Size</th>
            <th className="py-3 pr-4 font-medium text-right">Entry</th>
            <th className="py-3 pr-4 font-medium text-right">LTP</th>
            <th className="py-3 pr-4 font-medium">Stop</th>
            <th className="py-3 pr-4 font-medium text-right">Age</th>
            <th className="py-3 pl-4 font-medium text-right">P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border/50 hover:bg-surface-hover transition-colors"
            >
              <td className="py-3 pr-4">
                <div className="font-medium text-text-primary">{p.nfoSymbol || p.symbol || EMPTY}</div>
                <div className="text-xs text-text-tertiary">
                  {p.strike ? `${p.strike} ` : ''}
                  <span
                    className={
                      p.optionType === 'CE'
                        ? 'text-success'
                        : p.optionType === 'PE'
                          ? 'text-error'
                          : ''
                    }
                  >
                    {p.optionType || EMPTY}
                  </span>
                  {p.expiry ? ` · ${p.expiry}` : ''}
                </div>
              </td>

              <td className="py-3 pr-4">
                <div className="text-text-secondary">{p.strategyId || EMPTY}</div>
                {p.tier ? <div className="text-xs text-text-tertiary">{p.tier}</div> : null}
              </td>

              <td className="py-3 pr-4 text-text-secondary tabular-nums">
                {formatLots(p.lots, p.lotSize)}
              </td>

              <td className="py-3 pr-4 text-right text-text-secondary tabular-nums">
                {formatCurrency(p.entryPrice)}
              </td>

              <td className="py-3 pr-4 text-right text-text-primary tabular-nums">
                {formatCurrency(p.currentPrice)}
              </td>

              <td className="py-3 pr-4">
                <StopCell position={p} />
              </td>

              <td className="py-3 pr-4 text-right">
                <AgeCell position={p} />
              </td>

              <td className="py-3 pl-4 text-right">
                <PnlCell pnl={p.pnl} pnlPct={p.pnlPct} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

PositionsTable.propTypes = {
  positions: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  reachable: PropTypes.bool,
};
