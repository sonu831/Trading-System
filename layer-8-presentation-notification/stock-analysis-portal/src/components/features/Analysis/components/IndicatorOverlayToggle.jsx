import React from 'react';
import PropTypes from 'prop-types';

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

  const handleToggle = (key) => {
    if (onToggle) {
      onToggle(key);
    }
  };

  return (
    <>
      <div className="overlay-toggle">
        <span className="toggle-label">Overlays:</span>
        <div className="toggle-buttons">
          {toggleOptions.map((option) => (
            <button
              key={option.key}
              className={`toggle-btn ${overlays?.[option.key] ? 'active' : ''}`}
              onClick={() => handleToggle(option.key)}
              title={option.description}
            >
              <span className="btn-icon">{option.icon}</span>
              <span className="btn-label">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .overlay-toggle {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
        }

        .toggle-label {
          font-size: 12px;
          color: #888;
          white-space: nowrap;
        }

        .toggle-buttons {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .toggle-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          color: #888;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn:hover {
          border-color: #3a3a4e;
          color: #aaa;
        }

        .toggle-btn.active {
          background: linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%);
          border-color: #667eea;
          color: #fff;
        }

        .btn-icon {
          font-size: 14px;
        }

        .btn-label {
          font-weight: 500;
        }

        @media (max-width: 640px) {
          .overlay-toggle {
            flex-direction: column;
            align-items: flex-start;
          }

          .toggle-buttons {
            width: 100%;
          }

          .toggle-btn {
            flex: 1;
            justify-content: center;
            min-width: 70px;
          }
        }
      `}</style>
    </>
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
