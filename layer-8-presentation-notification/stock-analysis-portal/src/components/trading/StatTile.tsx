// @ts-nocheck
import React from 'react';
import PropTypes from 'prop-types';
import { EMPTY } from '@/utils/format';

/**
 * Stat tile — label / value / optional delta / optional footnote.
 *
 * Contract (dataviz):
 *  - label: sentence case, no trailing colon, recessive ink
 *  - value: semibold, proportional figures (NOT tabular — tabular is for table columns)
 *  - delta: signed and named ("vs open"); colour is a supplement to the sign, never the only cue
 *  - unknown values render as an em-dash, never a confident 0
 */
const toneClasses = {
  neutral: 'text-text-primary',
  positive: 'text-success',
  negative: 'text-error',
  warning: 'text-warning',
};

export default function StatTile({
  label,
  value,
  tone = 'neutral',
  delta,
  deltaLabel,
  deltaTone = 'neutral',
  icon,
  footnote,
  className = '',
}) {
  const isEmpty = value === EMPTY || value === null || value === undefined;

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-4 flex flex-col gap-1 transition-colors ${className}`}
    >
      <div className="flex items-center gap-2 text-text-tertiary text-xs uppercase tracking-wider">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        <span>{label}</span>
      </div>

      <div
        className={`text-2xl font-semibold leading-tight ${isEmpty ? 'text-text-tertiary' : toneClasses[tone]}`}
      >
        {isEmpty ? EMPTY : value}
      </div>

      {delta !== undefined && delta !== null ? (
        <div className="flex items-baseline gap-1.5 text-xs">
          <span className={toneClasses[deltaTone]}>{delta}</span>
          {deltaLabel ? <span className="text-text-tertiary">{deltaLabel}</span> : null}
        </div>
      ) : null}

      {footnote ? <div className="text-xs text-text-tertiary mt-0.5">{footnote}</div> : null}
    </div>
  );
}

StatTile.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node,
  tone: PropTypes.oneOf(['neutral', 'positive', 'negative', 'warning']),
  delta: PropTypes.node,
  deltaLabel: PropTypes.string,
  deltaTone: PropTypes.oneOf(['neutral', 'positive', 'negative', 'warning']),
  icon: PropTypes.node,
  footnote: PropTypes.node,
  className: PropTypes.string,
};
