import React from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui';

/**
 * CandlePatternBadges Component
 * Displays detected candlestick patterns as colored badges
 */
export default function CandlePatternBadges({ patterns, maxDisplay = 5 }) {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="p-3 bg-slate-900/50 border border-white/10 rounded-lg backdrop-blur-sm flex items-center justify-center">
        <span className="text-sm text-slate-500">No patterns detected in recent candles</span>
      </div>
    );
  }

  // Take last N patterns (most recent)
  const recentPatterns = patterns.slice(-maxDisplay);

  const getPatternVariant = (type) => {
    if (type === 'bullish') return 'success';
    if (type === 'bearish') return 'error';
    return 'warning';
  };

  const formatPatternName = (name) => {
    // Convert camelCase or snake_case to readable
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const formatTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="p-4 bg-slate-900/50 border border-white/10 rounded-lg backdrop-blur-sm">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm font-semibold text-slate-100 uppercase tracking-wide">Candlestick Patterns</span>
        <span className="text-xs text-slate-500 bg-white/5 px-2 py-0.5 rounded ml-2">
          {patterns.length} detected
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentPatterns.map((patternGroup, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-black/20 p-2 rounded-md border border-white/5">
            {patternGroup.patterns?.map((pattern, pIdx) => {
              return (
                <Badge
                  key={pIdx}
                  variant={getPatternVariant(pattern.type)}
                  size="sm"
                  title={`${formatPatternName(pattern.name)} at ${formatTime(patternGroup.time)}`}
                >
                  <span className="mr-1">{pattern.type === 'bullish' ? '▲' : '▼'}</span>
                  {formatPatternName(pattern.name)}
                </Badge>
              );
            })}
            {patternGroup.time && (
              <span className="text-[10px] text-slate-500 font-mono ml-1">
                {formatTime(patternGroup.time)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

CandlePatternBadges.propTypes = {
  patterns: PropTypes.arrayOf(
    PropTypes.shape({
      index: PropTypes.number,
      time: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      patterns: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string.isRequired,
          type: PropTypes.oneOf(['bullish', 'bearish']).isRequired,
        })
      ),
    })
  ),
  maxDisplay: PropTypes.number,
};
