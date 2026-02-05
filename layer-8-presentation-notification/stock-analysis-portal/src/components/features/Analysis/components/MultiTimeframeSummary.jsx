import React from 'react';
import PropTypes from 'prop-types';

/**
 * MultiTimeframeSummary Component
 * Shows trend state for different timeframes
 */
export default function MultiTimeframeSummary({ data }) {
  if (!data) return null;

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'Overbought':
        return 'text-error bg-error/10';
      case 'Bullish':
        return 'text-success bg-success/10';
      case 'Oversold':
        return 'text-success bg-success/10';
      case 'Bearish':
        return 'text-error bg-error/10';
      default:
        return 'text-warning bg-warning/10';
    }
  };

  const intervalLabels = {
    '15m': '15 Min',
    '1h': '1 Hour',
    '1d': 'Daily',
    '1w': 'Weekly',
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="bg-surface px-4 py-2 border-b border-border">
        <h3 className="text-sm font-bold text-text-primary">Multi-Timeframe Analysis</h3>
      </div>
      <div className="divide-y divide-border">
        {Object.entries(data).map(([interval, { rsi, trend }]) => (
          <div key={interval} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-text-secondary">{intervalLabels[interval] || interval}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-text-tertiary">
                RSI: {rsi?.toFixed(1) || 'N/A'}
              </span>
              <span
                className={`px-2 py-0.5 text-xs font-bold rounded ${getTrendColor(trend)}`}
              >
                {trend || 'Unknown'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

MultiTimeframeSummary.propTypes = {
  data: PropTypes.object,
};
