import React from 'react';
import PropTypes from 'prop-types';
import { useStaleness } from '@/hooks/useStaleness';
import { timeAgo } from '@/utils/format';

/**
 * Dashboard rule U4: stale data must announce itself.
 *
 * fresh (<30s) quiet · warn (>=30s) amber · stale (>=2min) red + explicit warning.
 * The words carry the meaning; the colour reinforces it.
 */
export default function StaleBadge({ timestamp, warnAfter, staleAfter, className = '' }) {
  const { level } = useStaleness(timestamp, { warnAfter, staleAfter });

  const styles = {
    fresh: 'text-text-tertiary',
    warn: 'text-warning',
    stale: 'text-error font-semibold',
    unknown: 'text-text-tertiary',
  };

  const text = {
    fresh: `updated ${timeAgo(timestamp)}`,
    warn: `updated ${timeAgo(timestamp)}`,
    stale: `STALE — ${timeAgo(timestamp)} · do not trade on this`,
    unknown: 'no data',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${styles[level]} ${className}`}>
      <span
        aria-hidden="true"
        className={`w-1.5 h-1.5 rounded-full ${
          level === 'stale'
            ? 'bg-error animate-pulse'
            : level === 'warn'
              ? 'bg-warning'
              : level === 'fresh'
                ? 'bg-success'
                : 'bg-text-tertiary'
        }`}
      />
      {text[level]}
    </span>
  );
}

StaleBadge.propTypes = {
  timestamp: PropTypes.string,
  warnAfter: PropTypes.number,
  staleAfter: PropTypes.number,
  className: PropTypes.string,
};
