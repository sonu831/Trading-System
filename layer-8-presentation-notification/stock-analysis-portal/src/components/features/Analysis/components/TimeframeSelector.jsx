import React from 'react';
import PropTypes from 'prop-types';

const INTERVALS = [
  { key: '1m', label: '1m' },
  { key: '5m', label: '5m' },
  { key: '15m', label: '15m' },
  { key: '30m', label: '30m' },
  { key: '1h', label: '1H' },
  { key: '4h', label: '4H' },
  { key: '1d', label: '1D' },
  { key: '1w', label: '1W' },
];

/**
 * TimeframeSelector Component
 * Horizontal button group for selecting chart timeframe
 */
export default function TimeframeSelector({ selected, onChange, disabled = false }) {
  return (
    <div className="flex gap-1 bg-background border border-border rounded-lg p-1">
      {INTERVALS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs font-bold rounded transition-all ${
            selected === key
              ? 'bg-primary text-white shadow'
              : 'text-text-tertiary hover:text-text-primary hover:bg-surface'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

TimeframeSelector.propTypes = {
  selected: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};
