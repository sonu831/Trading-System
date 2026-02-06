import React from 'react';
import PropTypes from 'prop-types';

/**
 * EnhancedMultiTFSummary Component
 * Shows 6-timeframe analysis with indicators and 7-factor verdicts
 *
 * Accepts API response format:
 * {
 *   '5m': { verdict: {...}, rsi, macdHistogram, supertrend: 'Bullish'|'Bearish', trend },
 *   '15m': {...},
 *   ...
 * }
 */
export default function EnhancedMultiTFSummary({ data }) {
  // Handle both formats: { timeframes: {...} } or direct { '5m': {...}, '15m': {...} }
  const timeframes = data?.timeframes || data;

  if (!timeframes || Object.keys(timeframes).length === 0) return null;

  // Calculate overall verdict from all timeframes
  const calculateOverallVerdict = () => {
    const intervals = ['5m', '15m', '1h', '4h', '1d', '1w'];
    let totalScore = 0;
    let count = 0;

    for (const interval of intervals) {
      const tf = timeframes[interval];
      if (tf?.verdict?.score !== undefined) {
        totalScore += tf.verdict.score;
        count++;
      }
    }

    if (count === 0) return null;

    const avgScore = totalScore / count;
    const confidence = Math.min(100, Math.abs(avgScore / 14) * 100);

    let signal;
    if (avgScore >= 4) signal = 'Strong Buy';
    else if (avgScore >= 2) signal = 'Buy';
    else if (avgScore <= -4) signal = 'Strong Sell';
    else if (avgScore <= -2) signal = 'Sell';
    else signal = 'Neutral';

    return { signal, confidence: Math.round(confidence) };
  };

  const overallVerdict = data?.overallVerdict || calculateOverallVerdict();

  const getVerdictColor = (signal) => {
    switch (signal) {
      case 'Strong Buy':
        return 'bg-success text-white';
      case 'Buy':
        return 'bg-success/70 text-white';
      case 'Strong Sell':
        return 'bg-error text-white';
      case 'Sell':
        return 'bg-error/70 text-white';
      default:
        return 'bg-warning/70 text-white';
    }
  };

  const getTrendIcon = (direction) => {
    if (direction === 1 || direction === 'up' || direction === 'Bullish') return '▲';
    if (direction === -1 || direction === 'down' || direction === 'Bearish') return '▼';
    return '●';
  };

  const getTrendColor = (direction) => {
    if (direction === 1 || direction === 'up' || direction === 'Bullish') return 'text-success';
    if (direction === -1 || direction === 'down' || direction === 'Bearish') return 'text-error';
    return 'text-warning';
  };

  // Helper to get MACD histogram value (handles both macdHist and macdHistogram)
  const getMacdHist = (tf) => tf?.macdHist ?? tf?.macdHistogram ?? null;

  // Helper to get supertrend direction (handles both object and string formats)
  const getSupertrendDirection = (tf) => {
    if (!tf?.supertrend) return null;
    // If supertrend is a string like 'Bullish' or 'Bearish'
    if (typeof tf.supertrend === 'string') return tf.supertrend;
    // If supertrend is an object with direction property
    return tf.supertrend.direction;
  };

  // Helper to get BB position
  const getBBPosition = (tf) => {
    if (tf?.bbPosition !== undefined) return tf.bbPosition;
    // Try to get from verdict factors
    const bbFactor = tf?.verdict?.factors?.bb?.position;
    if (bbFactor) {
      // Parse "42%" to 0.42
      const match = bbFactor.match(/(\d+)%/);
      if (match) return parseInt(match[1]) / 100;
    }
    return null;
  };

  const intervalLabels = {
    '5m': '5 Min',
    '15m': '15 Min',
    '1h': '1 Hour',
    '4h': '4 Hour',
    '1d': 'Daily',
    '1w': 'Weekly',
  };

  const intervals = ['5m', '15m', '1h', '4h', '1d', '1w'];

  return (
    <>
      <div className="enhanced-multi-tf">
        <div className="header">
          <h3>Multi-Timeframe Analysis</h3>
          {overallVerdict && (
            <span className={`overall-verdict ${getVerdictColor(overallVerdict.signal)}`}>
              {overallVerdict.signal} ({overallVerdict.confidence}%)
            </span>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Timeframe</th>
                <th>RSI</th>
                <th>MACD</th>
                <th>Supertrend</th>
                <th>BB Position</th>
                <th>Verdict</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              {intervals.map((interval) => {
                const tf = timeframes[interval];
                if (!tf) return null;

                const macdHist = getMacdHist(tf);
                const supertrendDir = getSupertrendDirection(tf);
                const bbPos = getBBPosition(tf);

                return (
                  <tr key={interval}>
                    <td className="interval">{intervalLabels[interval]}</td>
                    <td className="numeric">
                      <span className={tf.rsi > 70 ? 'text-error' : tf.rsi < 30 ? 'text-success' : ''}>
                        {tf.rsi?.toFixed(1) || 'N/A'}
                      </span>
                    </td>
                    <td className="numeric">
                      <span className={macdHist > 0 ? 'text-success' : 'text-error'}>
                        {macdHist?.toFixed(2) || 'N/A'}
                      </span>
                    </td>
                    <td className="trend">
                      <span className={getTrendColor(supertrendDir)}>
                        {getTrendIcon(supertrendDir)}
                      </span>
                    </td>
                    <td className="numeric">
                      {bbPos !== null ? `${(bbPos * 100).toFixed(0)}%` : 'N/A'}
                    </td>
                    <td>
                      <span className={`verdict-badge ${getVerdictColor(tf.verdict?.signal)}`}>
                        {tf.verdict?.signal || 'N/A'}
                      </span>
                    </td>
                    <td>
                      <div className="confidence-bar">
                        <div
                          className="confidence-fill"
                          style={{
                            width: `${tf.verdict?.confidence || 0}%`,
                            backgroundColor:
                              tf.verdict?.signal?.includes('Buy')
                                ? '#10b981'
                                : tf.verdict?.signal?.includes('Sell')
                                ? '#ef4444'
                                : '#f59e0b',
                          }}
                        />
                        <span className="confidence-text">{tf.verdict?.confidence || 0}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .enhanced-multi-tf {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 12px;
          overflow: hidden;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #2a2a3e;
          background: #1a1a2e;
        }

        .header h3 {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .overall-verdict {
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .table-container {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        th {
          text-align: left;
          padding: 12px 16px;
          background: #15152a;
          color: #888;
          font-weight: 500;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          white-space: nowrap;
        }

        td {
          padding: 12px 16px;
          border-bottom: 1px solid #2a2a3e;
          color: #ddd;
        }

        tr:last-child td {
          border-bottom: none;
        }

        tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .interval {
          font-weight: 500;
          color: #fff;
        }

        .numeric {
          font-family: monospace;
        }

        .trend {
          font-size: 16px;
        }

        .text-success {
          color: #10b981;
        }

        .text-error {
          color: #ef4444;
        }

        .text-warning {
          color: #f59e0b;
        }

        .verdict-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
        }

        .confidence-bar {
          position: relative;
          width: 80px;
          height: 20px;
          background: #2a2a3e;
          border-radius: 4px;
          overflow: hidden;
        }

        .confidence-fill {
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .confidence-text {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          font-size: 10px;
          font-weight: 600;
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        }

        .bg-success {
          background: #10b981;
        }

        .bg-success\\/70 {
          background: rgba(16, 185, 129, 0.7);
        }

        .bg-error {
          background: #ef4444;
        }

        .bg-error\\/70 {
          background: rgba(239, 68, 68, 0.7);
        }

        .bg-warning\\/70 {
          background: rgba(245, 158, 11, 0.7);
        }
      `}</style>
    </>
  );
}

EnhancedMultiTFSummary.propTypes = {
  data: PropTypes.shape({
    timeframes: PropTypes.object,
    overallVerdict: PropTypes.shape({
      signal: PropTypes.string,
      confidence: PropTypes.number,
    }),
  }),
};
