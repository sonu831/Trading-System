// @ts-nocheck
import React from 'react';
import PropTypes from 'prop-types';
import { EMPTY } from '@/utils/format';

/**
 * Risk meter — how close are we to a hard limit?
 *
 * Contract (dataviz): the FILL carries severity (accent -> warning -> danger);
 * the unfilled TRACK is a lighter step of the same ramp, so state reads across
 * the whole bar rather than only at the fill edge.
 *
 * Severity is also stated in words next to the meter — never colour alone.
 */
const RAMPS = {
  safe: { fill: 'bg-primary', track: 'bg-primary/15', text: 'text-text-secondary', word: 'Within limits' },
  warn: { fill: 'bg-warning', track: 'bg-warning/15', text: 'text-warning', word: 'Approaching limit' },
  danger: { fill: 'bg-error', track: 'bg-error/20', text: 'text-error', word: 'Limit reached' },
};

function severityFor(pct) {
  if (pct >= 100) return 'danger';
  if (pct >= 70) return 'warn';
  return 'safe';
}

export default function RiskMeter({ label, used, limit, formatValue, invertWords, className = '' }) {
  const known = Number.isFinite(used) && Number.isFinite(limit) && limit > 0;
  const rawPct = known ? (used / limit) * 100 : null;
  const pct = known ? Math.min(100, Math.max(0, rawPct)) : 0;
  const severity = known ? severityFor(rawPct) : 'safe';
  const ramp = RAMPS[severity];

  const fmt = formatValue || ((v) => (Number.isFinite(v) ? String(v) : EMPTY));

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-wider text-text-tertiary">{label}</span>
        <span className="text-sm text-text-primary tabular-nums">
          {known ? (
            <>
              <span className={severity === 'safe' ? '' : ramp.text}>{fmt(used)}</span>
              <span className="text-text-tertiary"> / {fmt(limit)}</span>
            </>
          ) : (
            <span className="text-text-tertiary">{EMPTY}</span>
          )}
        </span>
      </div>

      <div
        className={`h-2 w-full rounded-full overflow-hidden ${ramp.track}`}
        role="meter"
        aria-valuenow={known ? Math.round(rawPct) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${ramp.fill}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Severity in words — the colour is a supplement, not the message. */}
      <div className={`text-xs ${known ? ramp.text : 'text-text-tertiary'}`}>
        {known ? `${Math.round(rawPct)}% · ${invertWords?.[severity] || ramp.word}` : 'No data from engine'}
      </div>
    </div>
  );
}

RiskMeter.propTypes = {
  label: PropTypes.string.isRequired,
  used: PropTypes.number,
  limit: PropTypes.number,
  formatValue: PropTypes.func,
  invertWords: PropTypes.object,
  className: PropTypes.string,
};
