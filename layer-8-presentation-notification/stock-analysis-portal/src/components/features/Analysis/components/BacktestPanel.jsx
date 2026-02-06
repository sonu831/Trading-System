import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * BacktestPanel Component
 * Condition builder + statistics + results table for historical backtesting
 */

const INDICATORS = [
  { value: 'rsi', label: 'RSI', presets: [{ label: 'Oversold', operator: 'lt', threshold: 30 }, { label: 'Overbought', operator: 'gt', threshold: 70 }] },
  { value: 'macd_hist', label: 'MACD Histogram', presets: [{ label: 'Bearish Cross', operator: 'lt', threshold: 0 }, { label: 'Bullish Cross', operator: 'gt', threshold: 0 }] },
  { value: 'stochastic_k', label: 'Stochastic %K', presets: [{ label: 'Oversold', operator: 'lt', threshold: 20 }, { label: 'Overbought', operator: 'gt', threshold: 80 }] },
  { value: 'bb_position', label: 'BB Position', presets: [{ label: 'Below Lower', operator: 'lt', threshold: 0 }, { label: 'Above Upper', operator: 'gt', threshold: 1 }] },
];

const OPERATORS = [
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
];

export default function BacktestPanel({ results, loading, error, onRunBacktest, onClear, symbol }) {
  const [indicator, setIndicator] = useState('rsi');
  const [operator, setOperator] = useState('lt');
  const [threshold, setThreshold] = useState(30);

  const handleRun = useCallback(() => {
    if (onRunBacktest && symbol) {
      onRunBacktest(symbol, indicator, operator, threshold);
    }
  }, [onRunBacktest, symbol, indicator, operator, threshold]);

  const handlePresetClick = useCallback((ind, preset) => {
    setIndicator(ind);
    setOperator(preset.operator);
    setThreshold(preset.threshold);
  }, []);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatPercent = (val) => {
    if (val === undefined || val === null) return 'N/A';
    const formatted = (val * 100).toFixed(2);
    return val >= 0 ? `+${formatted}%` : `${formatted}%`;
  };

  const getReturnColor = (val) => {
    if (val === undefined || val === null) return '';
    return val >= 0 ? 'positive' : 'negative';
  };

  const currentIndicator = INDICATORS.find((i) => i.value === indicator);

  return (
    <>
      <div className="backtest-panel">
        <div className="header">
          <h3>Historical Backtest</h3>
          <span className="subtitle">Test indicator conditions on 10 years of data</span>
        </div>

        {/* Condition Builder */}
        <div className="condition-builder">
          <div className="builder-row">
            <div className="field">
              <label>Indicator</label>
              <select value={indicator} onChange={(e) => setIndicator(e.target.value)}>
                {INDICATORS.map((ind) => (
                  <option key={ind.value} value={ind.value}>
                    {ind.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Condition</label>
              <select value={operator} onChange={(e) => setOperator(e.target.value)}>
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Threshold</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
                step={indicator === 'bb_position' ? 0.1 : 1}
              />
            </div>
            <div className="field actions">
              <button onClick={handleRun} disabled={loading} className="run-btn">
                {loading ? 'Running...' : 'Run Backtest'}
              </button>
              {results && (
                <button onClick={onClear} className="clear-btn">
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Quick Presets */}
          <div className="presets">
            <span className="presets-label">Quick Presets:</span>
            {currentIndicator?.presets.map((preset, idx) => (
              <button
                key={idx}
                className="preset-btn"
                onClick={() => handlePresetClick(indicator, preset)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="error-state">
            <span className="error-icon">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Analyzing 2500+ data points...</span>
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div className="results">
            {/* Statistics Grid */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Signals Found</span>
                <span className="stat-value">{results.stats?.signalCount || 0}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Win Rate (5D)</span>
                <span className={`stat-value ${getReturnColor(results.stats?.winRate5D - 0.5)}`}>
                  {results.stats?.winRate5D ? `${(results.stats.winRate5D * 100).toFixed(1)}%` : 'N/A'}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Avg Return (5D)</span>
                <span className={`stat-value ${getReturnColor(results.stats?.avgReturn5D)}`}>
                  {formatPercent(results.stats?.avgReturn5D)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Avg Return (10D)</span>
                <span className={`stat-value ${getReturnColor(results.stats?.avgReturn10D)}`}>
                  {formatPercent(results.stats?.avgReturn10D)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Avg Return (20D)</span>
                <span className={`stat-value ${getReturnColor(results.stats?.avgReturn20D)}`}>
                  {formatPercent(results.stats?.avgReturn20D)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Best (20D)</span>
                <span className={`stat-value ${getReturnColor(results.stats?.best20D)}`}>
                  {formatPercent(results.stats?.best20D)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Worst (20D)</span>
                <span className={`stat-value ${getReturnColor(results.stats?.worst20D)}`}>
                  {formatPercent(results.stats?.worst20D)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Data Period</span>
                <span className="stat-value small">{results.stats?.dataRange || 'N/A'}</span>
              </div>
            </div>

            {/* Results Table */}
            {results.signals && results.signals.length > 0 && (
              <div className="results-table-container">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Price</th>
                      <th>Indicator</th>
                      <th>5D Return</th>
                      <th>10D Return</th>
                      <th>20D Return</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.signals.slice(0, 50).map((signal, idx) => (
                      <tr key={idx}>
                        <td>{formatDate(signal.date)}</td>
                        <td className="numeric">{signal.price?.toFixed(2)}</td>
                        <td className="numeric">{signal.indicatorValue?.toFixed(2)}</td>
                        <td className={`numeric ${getReturnColor(signal.return5D)}`}>
                          {formatPercent(signal.return5D)}
                        </td>
                        <td className={`numeric ${getReturnColor(signal.return10D)}`}>
                          {formatPercent(signal.return10D)}
                        </td>
                        <td className={`numeric ${getReturnColor(signal.return20D)}`}>
                          {formatPercent(signal.return20D)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.signals.length > 50 && (
                  <div className="table-footer">
                    Showing 50 of {results.signals.length} signals
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .backtest-panel {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 12px;
          padding: 20px;
        }

        .header {
          margin-bottom: 20px;
        }

        .header h3 {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
          margin: 0 0 4px 0;
        }

        .subtitle {
          font-size: 12px;
          color: #888;
        }

        .condition-builder {
          background: #15152a;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .builder-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: flex-end;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
        }

        .field select,
        .field input {
          background: #1a1a2e;
          border: 1px solid #2a2a3e;
          border-radius: 6px;
          padding: 8px 12px;
          color: #fff;
          font-size: 13px;
          min-width: 120px;
        }

        .field select:focus,
        .field input:focus {
          outline: none;
          border-color: #667eea;
        }

        .field.actions {
          display: flex;
          flex-direction: row;
          gap: 8px;
          margin-left: auto;
        }

        .run-btn {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          transition: transform 0.2s, opacity 0.2s;
        }

        .run-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .run-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .clear-btn {
          background: transparent;
          border: 1px solid #666;
          color: #aaa;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          transition: border-color 0.2s, color 0.2s;
        }

        .clear-btn:hover {
          border-color: #ef4444;
          color: #ef4444;
        }

        .presets {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .presets-label {
          font-size: 11px;
          color: #666;
        }

        .preset-btn {
          background: #2a2a3e;
          border: none;
          color: #aaa;
          padding: 4px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
          transition: background 0.2s, color 0.2s;
        }

        .preset-btn:hover {
          background: #3a3a4e;
          color: #fff;
        }

        .error-state {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 8px;
          color: #ef4444;
          font-size: 13px;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px;
          color: #888;
          font-size: 14px;
        }

        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid #2a2a3e;
          border-top-color: #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: #15152a;
          border-radius: 8px;
          padding: 12px;
          text-align: center;
        }

        .stat-label {
          display: block;
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          font-family: monospace;
        }

        .stat-value.small {
          font-size: 12px;
        }

        .stat-value.positive {
          color: #10b981;
        }

        .stat-value.negative {
          color: #ef4444;
        }

        .results-table-container {
          overflow-x: auto;
          max-height: 400px;
          overflow-y: auto;
        }

        .results-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .results-table th {
          text-align: left;
          padding: 10px 12px;
          background: #15152a;
          color: #888;
          font-weight: 500;
          font-size: 10px;
          text-transform: uppercase;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .results-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #2a2a3e;
          color: #ddd;
        }

        .results-table tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .numeric {
          font-family: monospace;
          text-align: right;
        }

        .positive {
          color: #10b981;
        }

        .negative {
          color: #ef4444;
        }

        .table-footer {
          padding: 12px;
          text-align: center;
          font-size: 12px;
          color: #666;
          border-top: 1px solid #2a2a3e;
        }
      `}</style>
    </>
  );
}

BacktestPanel.propTypes = {
  results: PropTypes.shape({
    condition: PropTypes.object,
    stats: PropTypes.shape({
      signalCount: PropTypes.number,
      avgReturn5D: PropTypes.number,
      avgReturn10D: PropTypes.number,
      avgReturn20D: PropTypes.number,
      winRate5D: PropTypes.number,
      best20D: PropTypes.number,
      worst20D: PropTypes.number,
      dataRange: PropTypes.string,
    }),
    signals: PropTypes.arrayOf(
      PropTypes.shape({
        date: PropTypes.string,
        price: PropTypes.number,
        indicatorValue: PropTypes.number,
        return5D: PropTypes.number,
        return10D: PropTypes.number,
        return20D: PropTypes.number,
      })
    ),
  }),
  loading: PropTypes.bool,
  error: PropTypes.string,
  onRunBacktest: PropTypes.func,
  onClear: PropTypes.func,
  symbol: PropTypes.string,
};
