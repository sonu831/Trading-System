// @ts-nocheck
import React from 'react';
import PropTypes from 'prop-types';
import { secondsSince, timeAgo } from '@/utils/format';

const DEFAULT_WARN_AFTER = 30;  // seconds → amber
const DEFAULT_STALE_AFTER = 120; // seconds → red

export default function StaleBadge({ timestamp, warnAfter, staleAfter, className = '' }) {
  if (!timestamp) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-text-tertiary ${className}`}>
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
        no data
      </span>
    );
  }

  const seconds = secondsSince(timestamp);
  if (seconds === null) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-text-tertiary ${className}`}>
        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-text-tertiary" />
        unknown
      </span>
    );
  }

  const warnThreshold = warnAfter ?? DEFAULT_WARN_AFTER;
  const staleThreshold = staleAfter ?? DEFAULT_STALE_AFTER;

  const level = seconds >= staleThreshold ? 'stale' : seconds >= warnThreshold ? 'warn' : 'fresh';

  const styles = {
    fresh: 'text-text-tertiary',
    warn: 'text-warning',
    stale: 'text-error font-semibold',
  };

  const text = {
    fresh: `updated ${timeAgo(timestamp)}`,
    warn: `updated ${timeAgo(timestamp)}`,
    stale: `STALE — ${timeAgo(timestamp)} · do not trade on this`,
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
              : 'bg-success'
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
