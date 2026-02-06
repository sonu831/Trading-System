import React from 'react';
import PropTypes from 'prop-types';

/**
 * PCRPanel Component
 * Options analysis panel showing Put-Call Ratio and Max Pain
 */
export default function PCRPanel({ data }) {
  // Hide panel if no options data
  if (!data || data.message === 'No options data available') {
    return null;
  }

  const { pcr, pcrVolume, putOI, callOI, putVolume, callVolume, maxPain, sentiment } = data;

  const getSentimentColor = (s) => {
    if (s === 'Bullish' || s === 'bullish') return '#10b981';
    if (s === 'Bearish' || s === 'bearish') return '#ef4444';
    return '#f59e0b';
  };

  const getSentimentIcon = (s) => {
    if (s === 'Bullish' || s === 'bullish') return '▲';
    if (s === 'Bearish' || s === 'bearish') return '▼';
    return '●';
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)} K`;
    return num.toFixed(0);
  };

  const pcrColor = pcr > 1 ? '#10b981' : pcr < 0.7 ? '#ef4444' : '#f59e0b';

  return (
    <>
      <div className="pcr-panel">
        <div className="header">
          <h3>Options Analysis</h3>
          {sentiment && (
            <span className="sentiment" style={{ color: getSentimentColor(sentiment) }}>
              {getSentimentIcon(sentiment)} {sentiment}
            </span>
          )}
        </div>

        <div className="metrics-grid">
          <div className="metric-card highlight">
            <span className="label">PCR (OI)</span>
            <span className="value" style={{ color: pcrColor }}>
              {pcr?.toFixed(2) || 'N/A'}
            </span>
            <span className="hint">{pcr > 1 ? 'Bullish' : pcr < 0.7 ? 'Bearish' : 'Neutral'}</span>
          </div>

          <div className="metric-card">
            <span className="label">PCR (Volume)</span>
            <span className="value">{pcrVolume?.toFixed(2) || 'N/A'}</span>
          </div>

          {maxPain && (
            <div className="metric-card highlight">
              <span className="label">Max Pain</span>
              <span className="value">{maxPain.toLocaleString()}</span>
              <span className="hint">Strike price</span>
            </div>
          )}
        </div>

        <div className="oi-breakdown">
          <div className="breakdown-header">Open Interest Breakdown</div>
          <div className="bars">
            <div className="bar-container">
              <span className="bar-label">Put OI</span>
              <div className="bar">
                <div
                  className="bar-fill put"
                  style={{
                    width: `${putOI && callOI ? (putOI / (putOI + callOI)) * 100 : 50}%`,
                  }}
                />
              </div>
              <span className="bar-value">{formatNumber(putOI)}</span>
            </div>
            <div className="bar-container">
              <span className="bar-label">Call OI</span>
              <div className="bar">
                <div
                  className="bar-fill call"
                  style={{
                    width: `${putOI && callOI ? (callOI / (putOI + callOI)) * 100 : 50}%`,
                  }}
                />
              </div>
              <span className="bar-value">{formatNumber(callOI)}</span>
            </div>
          </div>
        </div>

        {(putVolume || callVolume) && (
          <div className="volume-breakdown">
            <div className="breakdown-header">Volume Breakdown</div>
            <div className="volume-stats">
              <div className="vol-stat">
                <span className="vol-label">Put Vol</span>
                <span className="vol-value put">{formatNumber(putVolume)}</span>
              </div>
              <div className="vol-stat">
                <span className="vol-label">Call Vol</span>
                <span className="vol-value call">{formatNumber(callVolume)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .pcr-panel {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 12px;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .header h3 {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .sentiment {
          font-size: 13px;
          font-weight: 600;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .metric-card {
          background: #15152a;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }

        .metric-card.highlight {
          border: 1px solid #3b82f6;
        }

        .label {
          display: block;
          font-size: 11px;
          color: #888;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          font-family: monospace;
        }

        .hint {
          display: block;
          font-size: 10px;
          color: #666;
          margin-top: 2px;
        }

        .oi-breakdown,
        .volume-breakdown {
          margin-top: 16px;
        }

        .breakdown-header {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .bars {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bar-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .bar-label {
          width: 60px;
          font-size: 12px;
          color: #aaa;
        }

        .bar {
          flex: 1;
          height: 8px;
          background: #2a2a3e;
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .bar-fill.put {
          background: #ef4444;
        }

        .bar-fill.call {
          background: #10b981;
        }

        .bar-value {
          width: 70px;
          text-align: right;
          font-size: 12px;
          font-family: monospace;
          color: #ddd;
        }

        .volume-stats {
          display: flex;
          gap: 24px;
        }

        .vol-stat {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .vol-label {
          font-size: 12px;
          color: #888;
        }

        .vol-value {
          font-size: 14px;
          font-weight: 600;
          font-family: monospace;
        }

        .vol-value.put {
          color: #ef4444;
        }

        .vol-value.call {
          color: #10b981;
        }
      `}</style>
    </>
  );
}

PCRPanel.propTypes = {
  data: PropTypes.shape({
    pcr: PropTypes.number,
    pcrVolume: PropTypes.number,
    putOI: PropTypes.number,
    callOI: PropTypes.number,
    putVolume: PropTypes.number,
    callVolume: PropTypes.number,
    maxPain: PropTypes.number,
    sentiment: PropTypes.string,
    message: PropTypes.string,
  }),
};
