import React from 'react';
import PropTypes from 'prop-types';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { StaleBadge } from '@/components/trading';
import { EMPTY, formatPct } from '@/utils/format';

/**
 * Market regime — what kind of market is this, right now?
 *
 * This is what permits (or forbids) positional trades: when 1h AND Daily agree with
 * breadth, T3 opens. When the tape is ambiguous, the engine should stand aside.
 * Every state carries an icon + word; colour never carries meaning alone.
 */

const TREND = {
  TREND_UP: { label: 'Trend up', icon: TrendingUp, tone: 'text-success' },
  TREND_DOWN: { label: 'Trend down', icon: TrendingDown, tone: 'text-error' },
  RANGE: { label: 'Range / chop', icon: Minus, tone: 'text-text-secondary' },
  REVERSING: { label: 'Reversing', icon: RefreshCw, tone: 'text-warning' },
};

const VOL_TONE = {
  LOW: 'text-info',
  NORMAL: 'text-text-secondary',
  HIGH: 'text-warning',
};

const TIMEFRAMES = ['5m', '15m', '1h', 'D'];
const ALL_TIERS = [
  { key: 'T1', label: 'T1 Scalp' },
  { key: 'T2', label: 'T2 Intraday' },
  { key: 'T3', label: 'T3 Positional' },
];

/** One chip per timeframe: +1 bullish, -1 bearish, 0/absent neutral. */
function AlignmentStrip({ tfAlignment }) {
  return (
    <div className="flex items-center gap-2">
      {TIMEFRAMES.map((tf) => {
        const v = tfAlignment?.[tf];
        const known = Number.isFinite(v);
        const cls = !known
          ? 'bg-surface border-border text-text-tertiary'
          : v > 0
            ? 'bg-success/15 border-success/40 text-success'
            : v < 0
              ? 'bg-error/15 border-error/40 text-error'
              : 'bg-surface border-border text-text-secondary';
        const sign = !known ? EMPTY : v > 0 ? '▲' : v < 0 ? '▼' : '–';
        return (
          <div
            key={tf}
            className={`flex flex-col items-center justify-center min-w-[52px] px-2 py-1.5 rounded-lg border ${cls}`}
            title={`${tf}: ${!known ? 'unknown' : v > 0 ? 'bullish' : v < 0 ? 'bearish' : 'neutral'}`}
          >
            <span className="text-[10px] uppercase tracking-wider opacity-80">{tf}</span>
            <span className="text-sm leading-none mt-0.5">{sign}</span>
          </div>
        );
      })}
    </div>
  );
}

AlignmentStrip.propTypes = { tfAlignment: PropTypes.object };

function TierChips({ tradeableTiers }) {
  const known = Array.isArray(tradeableTiers);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ALL_TIERS.map(({ key, label }) => {
        const allowed = known && tradeableTiers.includes(key);
        return (
          <span
            key={key}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
              !known
                ? 'bg-surface border-border text-text-tertiary'
                : allowed
                  ? 'bg-success/10 border-success/40 text-success'
                  : 'bg-surface border-border text-text-tertiary line-through opacity-60'
            }`}
            title={!known ? 'Regime unknown' : allowed ? `${label} permitted` : `${label} not permitted`}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

TierChips.propTypes = { tradeableTiers: PropTypes.array };

export default function RegimeCard({ regime, lastUpdatedAt, reachable }) {
  if (reachable === false) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">Market regime</h3>
        <p className="text-text-tertiary text-sm">
          Regime engine unreachable — trade tiers cannot be evaluated.
        </p>
      </div>
    );
  }

  const trend = regime?.trend ? TREND[regime.trend] : null;
  const TrendIcon = trend?.icon;

  return (
    <div className="bg-surface border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-sm font-semibold text-text-primary">Market regime</h3>
        <StaleBadge timestamp={lastUpdatedAt} />
      </div>

      {/* Headline: trend + strength */}
      <div className="flex items-center gap-3">
        {TrendIcon ? (
          <span className={trend.tone} aria-hidden="true">
            <TrendIcon size={28} />
          </span>
        ) : null}
        <div>
          <div className={`text-xl font-semibold ${trend?.tone || 'text-text-tertiary'}`}>
            {trend?.label || EMPTY}
          </div>
          <div className="text-xs text-text-tertiary">
            strength {Number.isFinite(regime?.strength) ? formatPct(regime.strength * 100, { decimals: 0 }) : EMPTY}
            {' · '}
            confidence{' '}
            {Number.isFinite(regime?.confidence) ? formatPct(regime.confidence * 100, { decimals: 0 }) : EMPTY}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 mt-5 text-sm">
        <div>
          <dt className="text-xs text-text-tertiary uppercase tracking-wider">Volatility</dt>
          <dd className={`mt-1 font-medium ${VOL_TONE[regime?.volatility] || 'text-text-tertiary'}`}>
            {regime?.volatility || EMPTY}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-tertiary uppercase tracking-wider">Phase</dt>
          <dd className="mt-1 font-medium text-text-secondary">{regime?.phase || EMPTY}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
          Timeframe alignment
        </div>
        <AlignmentStrip tfAlignment={regime?.tfAlignment} />
      </div>

      <div className="mt-5 pt-4 border-t border-border">
        <div className="text-xs text-text-tertiary uppercase tracking-wider mb-2">
          Tradeable tiers
        </div>
        <TierChips tradeableTiers={regime?.tradeableTiers} />
        {!regime?.tradeableTiers?.length ? (
          <p className="text-xs text-text-tertiary mt-2">
            No tier permitted — the engine should stand aside in this regime.
          </p>
        ) : null}
      </div>
    </div>
  );
}

RegimeCard.propTypes = {
  regime: PropTypes.object,
  lastUpdatedAt: PropTypes.string,
  reachable: PropTypes.bool,
};
