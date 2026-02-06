import React from 'react';
import PropTypes from 'prop-types';

/**
 * CandlePatternBadges Component
 * Displays detected candlestick patterns as colored badges
 */
export default function CandlePatternBadges({ patterns, maxDisplay = 5 }) {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="pattern-badges empty">
        <span className="no-patterns">No patterns detected in recent candles</span>
        <style jsx>{`
          .pattern-badges.empty {
            padding: 12px 16px;
            background: #1a1a2e;
            border: 1px solid #2a2a3e;
            border-radius: 8px;
          }
          .no-patterns {
            color: #666;
            font-size: 13px;
          }
        `}</style>
      </div>
    );
  }

  // Take last N patterns (most recent)
  const recentPatterns = patterns.slice(-maxDisplay);

  const getPatternStyle = (type) => {
    if (type === 'bullish') {
      return { bg: '#10b981', color: '#fff' };
    }
    if (type === 'bearish') {
      return { bg: '#ef4444', color: '#fff' };
    }
    return { bg: '#f59e0b', color: '#fff' };
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
    <>
      <div className="pattern-badges">
        <div className="header">
          <span className="title">Candlestick Patterns</span>
          <span className="count">{patterns.length} detected</span>
        </div>
        <div className="badges-container">
          {recentPatterns.map((patternGroup, idx) => (
            <div key={idx} className="pattern-group">
              {patternGroup.patterns?.map((pattern, pIdx) => {
                const style = getPatternStyle(pattern.type);
                return (
                  <div
                    key={pIdx}
                    className="badge"
                    style={{ backgroundColor: style.bg, color: style.color }}
                    title={`${formatPatternName(pattern.name)} at ${formatTime(patternGroup.time)}`}
                  >
                    <span className="pattern-icon">{pattern.type === 'bullish' ? '▲' : '▼'}</span>
                    <span className="pattern-name">{formatPatternName(pattern.name)}</span>
                  </div>
                );
              })}
              {patternGroup.time && (
                <span className="pattern-time">{formatTime(patternGroup.time)}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .pattern-badges {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .title {
          font-size: 13px;
          font-weight: 600;
          color: #fff;
        }

        .count {
          font-size: 11px;
          color: #888;
          background: #2a2a3e;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .badges-container {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .pattern-group {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #15152a;
          padding: 6px 10px;
          border-radius: 6px;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          cursor: help;
          transition: transform 0.2s;
        }

        .badge:hover {
          transform: scale(1.05);
        }

        .pattern-icon {
          font-size: 10px;
        }

        .pattern-name {
          white-space: nowrap;
        }

        .pattern-time {
          font-size: 10px;
          color: #666;
          margin-left: 4px;
        }
      `}</style>
    </>
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
