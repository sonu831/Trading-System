import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@/components/ui';

/**
 * IndicatorOverlayToggle Component
 * Toggle buttons row for chart overlays (EMA, Bollinger Bands, Supertrend)
 */
export default function IndicatorOverlayToggle({ overlays, onToggle }) {
  const toggleOptions = [
    { key: 'ema', label: 'EMA', icon: '〰️', description: 'EMA 9/21/50/200' },
    { key: 'bollinger', label: 'Bollinger', icon: '📊', description: 'BB (20, 2)' },
    { key: 'supertrend', label: 'Supertrend', icon: '📈', description: 'Trend Direction' },
    { key: 'volume', label: 'Volume', icon: '📶', description: 'Volume Bars' },
    { key: 'support', label: 'S/R', icon: '📍', description: 'Support/Resistance' },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 py-2">
      <span className="text-xs text-slate-500 whitespace-nowrap font-medium uppercase tracking-wider">Overlays:</span>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        {toggleOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => onToggle && onToggle(option.key)}
            title={option.description}
            className={`
              inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border
              ${overlays?.[option.key] 
                ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' 
                : 'bg-slate-900/50 border-white/10 text-slate-500 hover:text-slate-300 hover:border-white/20'
              }
            `}
          >
            <span className="text-sm">{option.icon}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

IndicatorOverlayToggle.propTypes = {
  overlays: PropTypes.shape({
    ema: PropTypes.bool,
    bollinger: PropTypes.bool,
    supertrend: PropTypes.bool,
    volume: PropTypes.bool,
    support: PropTypes.bool,
  }),
  onToggle: PropTypes.func.isRequired,
};

IndicatorOverlayToggle.defaultProps = {
  overlays: {
    ema: true,
    bollinger: false,
    supertrend: false,
    volume: true,
    support: false,
  },
};
