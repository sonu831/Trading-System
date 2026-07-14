// @ts-nocheck
import React from 'react';
import PropTypes from 'prop-types';
import { ShieldAlert } from 'lucide-react';
import RiskMeter from '@/components/trading/RiskMeter';
import { formatCurrency, formatNumber, EMPTY } from '@/utils/format';

/**
 * Daily risk envelope — how much room is left before the engine stops itself.
 *
 * The daily-loss meter is the important one: when it reaches 100% the circuit
 * breaker trips the (persisted) kill switch and no new entries are taken.
 */
export default function DailyRiskCard({ risk, killSwitch }) {
  const daily = risk?.dailyState;

  const dailyLoss = Number.isFinite(daily?.dailyLoss) ? daily.dailyLoss : null;
  const maxDailyLoss = Number.isFinite(risk?.maxDailyLoss) ? risk.maxDailyLoss : null;
  const tradesToday = Number.isFinite(daily?.tradesToday) ? daily.tradesToday : null;
  const maxTrades = Number.isFinite(risk?.maxTradesPerDay) ? risk.maxTradesPerDay : null;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-text-primary">Daily risk envelope</h3>
        {killSwitch ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-error">
            <ShieldAlert size={14} aria-hidden="true" />
            HALTED
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-6">
        <RiskMeter
          label="Daily loss vs circuit breaker"
          used={dailyLoss}
          limit={maxDailyLoss}
          formatValue={(v) => formatCurrency(v, { decimals: 0 })}
          invertWords={{
            safe: 'Within loss limit',
            warn: 'Approaching circuit breaker',
            danger: 'Circuit breaker tripped — trading halted',
          }}
        />

        <RiskMeter
          label="Trades today"
          used={tradesToday}
          limit={maxTrades}
          formatValue={(v) => formatNumber(v)}
          invertWords={{
            safe: 'Within daily trade count',
            warn: 'Approaching daily trade limit',
            danger: 'Daily trade limit reached',
          }}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 mt-6 pt-5 border-t border-border text-xs">
        <div>
          <dt className="text-text-tertiary">Max concurrent</dt>
          <dd className="text-text-primary tabular-nums mt-0.5">
            {Number.isFinite(risk?.maxConcurrent) ? risk.maxConcurrent : EMPTY}
          </dd>
        </div>
        <div>
          <dt className="text-text-tertiary">Entry cutoff</dt>
          <dd className="text-text-primary tabular-nums mt-0.5">{risk?.entryCutoff || EMPTY}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">Square-off</dt>
          <dd className="text-text-primary tabular-nums mt-0.5">{risk?.squareOff || EMPTY}</dd>
        </div>
        <div>
          <dt className="text-text-tertiary">Realised today</dt>
          <dd className="text-text-primary tabular-nums mt-0.5">
            {Number.isFinite(daily?.totalPnl) ? formatCurrency(daily.totalPnl) : EMPTY}
          </dd>
        </div>
      </dl>
    </div>
  );
}

DailyRiskCard.propTypes = {
  risk: PropTypes.object,
  killSwitch: PropTypes.bool,
};
