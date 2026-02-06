import React from 'react';
import PropTypes from 'prop-types';

/**
 * AIPredictionPanel Component
 * Displays AI prediction with gauge, confidence, and reasoning
 */
export default function AIPredictionPanel({ data, loading, error, onFetch }) {
  const renderSkeleton = () => (
    <div className="ai-panel skeleton">
      <div className="header">
        <div className="skeleton-text title" />
        <div className="skeleton-badge" />
      </div>
      <div className="gauge-section">
        <div className="skeleton-gauge" />
      </div>
      <div className="skeleton-text reasoning" />
      <div className="skeleton-text reasoning short" />
      <style jsx>{`
        .ai-panel.skeleton {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 12px;
          padding: 20px;
        }
        .skeleton-text {
          background: linear-gradient(90deg, #2a2a3e 25%, #3a3a4e 50%, #2a2a3e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 4px;
        }
        .skeleton-text.title {
          width: 120px;
          height: 16px;
        }
        .skeleton-text.reasoning {
          height: 14px;
          margin-top: 12px;
        }
        .skeleton-text.reasoning.short {
          width: 60%;
        }
        .skeleton-badge {
          width: 80px;
          height: 24px;
          background: linear-gradient(90deg, #2a2a3e 25%, #3a3a4e 50%, #2a2a3e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }
        .skeleton-gauge {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: linear-gradient(90deg, #2a2a3e 25%, #3a3a4e 50%, #2a2a3e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          margin: 20px auto;
        }
        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </div>
  );

  if (loading) {
    return renderSkeleton();
  }

  if (error) {
    return (
      <>
        <div className="ai-panel error-state">
          <div className="header">
            <h3>AI Prediction</h3>
          </div>
          <div className="error-message">
            <span className="error-icon">⚠</span>
            <p>{error}</p>
            {onFetch && (
              <button onClick={onFetch} className="retry-btn">
                Retry
              </button>
            )}
          </div>
        </div>
        <style jsx>{`
          .ai-panel.error-state {
            background: #1a1a2e;
            border: 1px solid #ef4444;
            border-radius: 12px;
            padding: 20px;
          }
          .header h3 {
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            margin: 0 0 16px 0;
          }
          .error-message {
            text-align: center;
            padding: 20px;
          }
          .error-icon {
            font-size: 32px;
            display: block;
            margin-bottom: 12px;
          }
          .error-message p {
            color: #ef4444;
            font-size: 13px;
            margin: 0 0 16px 0;
          }
          .retry-btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s;
          }
          .retry-btn:hover {
            background: #2563eb;
          }
        `}</style>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <div className="ai-panel empty-state">
          <div className="header">
            <h3>AI Prediction</h3>
          </div>
          <div className="empty-content">
            <span className="empty-icon">🤖</span>
            <p>Click to get AI prediction</p>
            {onFetch && (
              <button onClick={onFetch} className="fetch-btn">
                Get Prediction
              </button>
            )}
          </div>
        </div>
        <style jsx>{`
          .ai-panel.empty-state {
            background: #1a1a2e;
            border: 1px solid #2a2a3e;
            border-radius: 12px;
            padding: 20px;
          }
          .header h3 {
            font-size: 14px;
            font-weight: 600;
            color: #fff;
            margin: 0 0 16px 0;
          }
          .empty-content {
            text-align: center;
            padding: 20px;
          }
          .empty-icon {
            font-size: 40px;
            display: block;
            margin-bottom: 12px;
          }
          .empty-content p {
            color: #888;
            font-size: 13px;
            margin: 0 0 16px 0;
          }
          .fetch-btn {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .fetch-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          }
        `}</style>
      </>
    );
  }

  const { prediction, confidence, reasoning, modelVersion } = data;
  const isBullish = prediction > 0.5;
  const percentage = (prediction * 100).toFixed(1);
  const gaugeAngle = prediction * 180 - 90; // -90 to 90 degrees

  return (
    <>
      <div className="ai-panel">
        <div className="header">
          <h3>AI Prediction</h3>
          <span className={`signal-badge ${isBullish ? 'bullish' : 'bearish'}`}>
            {isBullish ? '▲ Bullish' : '▼ Bearish'}
          </span>
        </div>

        <div className="gauge-section">
          <div className="gauge-container">
            <svg viewBox="0 0 200 120" className="gauge-svg">
              {/* Background arc */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#2a2a3e"
                strokeWidth="16"
                strokeLinecap="round"
              />
              {/* Gradient arc */}
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="16"
                strokeLinecap="round"
                strokeDasharray={`${prediction * 251} 251`}
              />
              {/* Needle */}
              <line
                x1="100"
                y1="100"
                x2="100"
                y2="30"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                transform={`rotate(${gaugeAngle}, 100, 100)`}
              />
              <circle cx="100" cy="100" r="8" fill="#fff" />
            </svg>
            <div className="gauge-value">{percentage}%</div>
            <div className="gauge-labels">
              <span className="label-bearish">Bearish</span>
              <span className="label-bullish">Bullish</span>
            </div>
          </div>
        </div>

        <div className="confidence-section">
          <span className="confidence-label">Confidence</span>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: `${confidence}%` }} />
          </div>
          <span className="confidence-value">{confidence?.toFixed(0) || 0}%</span>
        </div>

        {reasoning && (
          <div className="reasoning-section">
            <span className="reasoning-label">Analysis</span>
            <p className="reasoning-text">{reasoning}</p>
          </div>
        )}

        {modelVersion && (
          <div className="model-info">
            <span>Model: {modelVersion}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .ai-panel {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 12px;
          padding: 20px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .header h3 {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          margin: 0;
        }

        .signal-badge {
          padding: 4px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
        }

        .signal-badge.bullish {
          background: #10b981;
          color: white;
        }

        .signal-badge.bearish {
          background: #ef4444;
          color: white;
        }

        .gauge-section {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }

        .gauge-container {
          position: relative;
          width: 180px;
        }

        .gauge-svg {
          width: 100%;
          height: auto;
        }

        .gauge-value {
          position: absolute;
          bottom: 10px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 24px;
          font-weight: 700;
          color: #fff;
          font-family: monospace;
        }

        .gauge-labels {
          display: flex;
          justify-content: space-between;
          padding: 0 10px;
          margin-top: -5px;
        }

        .label-bearish {
          font-size: 10px;
          color: #ef4444;
        }

        .label-bullish {
          font-size: 10px;
          color: #10b981;
        }

        .confidence-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .confidence-label {
          font-size: 12px;
          color: #888;
          width: 70px;
        }

        .confidence-bar {
          flex: 1;
          height: 8px;
          background: #2a2a3e;
          border-radius: 4px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          border-radius: 4px;
          transition: width 0.3s ease;
        }

        .confidence-value {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
          width: 40px;
          text-align: right;
        }

        .reasoning-section {
          background: #15152a;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 12px;
        }

        .reasoning-label {
          display: block;
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .reasoning-text {
          font-size: 13px;
          color: #ccc;
          line-height: 1.5;
          margin: 0;
        }

        .model-info {
          text-align: right;
          font-size: 10px;
          color: #666;
        }
      `}</style>
    </>
  );
}

AIPredictionPanel.propTypes = {
  data: PropTypes.shape({
    prediction: PropTypes.number,
    confidence: PropTypes.number,
    reasoning: PropTypes.string,
    modelVersion: PropTypes.string,
  }),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onFetch: PropTypes.func,
};
