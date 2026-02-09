import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Card, Button, Input, Table, Badge } from '@/components/ui';

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

  const getReturnColorClass = (val) => {
    if (val === undefined || val === null) return 'text-slate-400';
    return val >= 0 ? 'text-emerald-400' : 'text-rose-400';
  };

  const currentIndicator = INDICATORS.find((i) => i.value === indicator);

  return (
    <Card className="h-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Historical Backtest</h3>
          <p className="text-sm text-slate-400 mt-1">Test indicator conditions on 10 years of data</p>
        </div>
        {results && (
          <Button variant="ghost" size="sm" onClick={onClear} className="text-slate-400 hover:text-white">
            Clear Results
          </Button>
        )}
      </div>

      {/* Condition Builder */}
      <div className="bg-slate-900/50 border border-white/5 rounded-lg p-4 mb-6 backdrop-blur-sm">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Indicator</label>
            <select
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
            >
              {INDICATORS.map((ind) => (
                <option key={ind.value} value={ind.value}>
                  {ind.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[80px]">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Condition</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/50 transition-colors"
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-[100px]">
            <label className="block text-xs font-medium text-slate-500 uppercase mb-1.5">Threshold</label>
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value) || 0)}
              step={indicator === 'bb_position' ? 0.1 : 1}
              className="w-full"
            />
          </div>
          <div className="flex-none">
            <Button
              onClick={handleRun}
              disabled={loading}
              variant="primary"
              className="w-full sm:w-auto"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Running...
                </>
              ) : (
                'Run Backtest'
              )}
            </Button>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500 font-medium">Quick Presets:</span>
          {currentIndicator?.presets.map((preset, idx) => (
            <button
              key={idx}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-300 rounded text-xs transition-colors border border-transparent hover:border-indigo-500/30"
              onClick={() => handlePresetClick(indicator, preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg p-4 mb-6 flex items-center gap-3 text-rose-400">
          <span className="text-xl">⚠</span>
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <StatsCard label="Signals Found" value={results.stats?.signalCount || 0} />
            <StatsCard
              label="Win Rate (5D)"
              value={results.stats?.winRate5D ? `${(results.stats.winRate5D * 100).toFixed(1)}%` : 'N/A'}
              colorClass={getReturnColorClass(results.stats?.winRate5D - 0.5)}
            />
            <StatsCard
              label="Avg Return (5D)"
              value={formatPercent(results.stats?.avgReturn5D)}
              colorClass={getReturnColorClass(results.stats?.avgReturn5D)}
            />
            <StatsCard
              label="Avg Return (10D)"
              value={formatPercent(results.stats?.avgReturn10D)}
              colorClass={getReturnColorClass(results.stats?.avgReturn10D)}
            />
            <StatsCard
              label="Avg Return (20D)"
              value={formatPercent(results.stats?.avgReturn20D)}
              colorClass={getReturnColorClass(results.stats?.avgReturn20D)}
            />
            <StatsCard
              label="Best (20D)"
              value={formatPercent(results.stats?.best20D)}
              colorClass={getReturnColorClass(results.stats?.best20D)}
            />
            <StatsCard
              label="Worst (20D)"
              value={formatPercent(results.stats?.worst20D)}
              colorClass={getReturnColorClass(results.stats?.worst20D)}
            />
            <StatsCard
              label="Data Period"
              value={results.stats?.dataRange || 'N/A'}
              className="text-xs"
            />
          </div>

          {/* Results Table */}
          {results.signals && results.signals.length > 0 && (
            <div className="border border-white/10 rounded-lg overflow-hidden">
              <Table className="w-full">
                <Table.Header>
                  <Table.Row className="bg-white/5 text-slate-400 text-xs uppercase tracking-wider">
                    <Table.HeaderCell className="px-4 py-3">Date</Table.HeaderCell>
                    <Table.HeaderCell className="px-4 py-3 text-right">Price</Table.HeaderCell>
                    <Table.HeaderCell className="px-4 py-3 text-right">Indicator</Table.HeaderCell>
                    <Table.HeaderCell className="px-4 py-3 text-right">5D Return</Table.HeaderCell>
                    <Table.HeaderCell className="px-4 py-3 text-right">10D Return</Table.HeaderCell>
                    <Table.HeaderCell className="px-4 py-3 text-right">20D Return</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body className="divide-y divide-white/5 text-slate-300 text-sm">
                  {results.signals.slice(0, 50).map((signal, idx) => (
                    <Table.Row key={idx} className="hover:bg-white/5 transition-colors">
                      <Table.Cell className="px-4 py-3 font-mono text-slate-400">{formatDate(signal.date)}</Table.Cell>
                      <Table.Cell className="px-4 py-3 text-right font-mono">{signal.price?.toFixed(2)}</Table.Cell>
                      <Table.Cell className="px-4 py-3 text-right font-mono text-indigo-300">{signal.indicatorValue?.toFixed(2)}</Table.Cell>
                      <Table.Cell className={`px-4 py-3 text-right font-mono font-medium ${getReturnColorClass(signal.return5D)}`}>
                        {formatPercent(signal.return5D)}
                      </Table.Cell>
                      <Table.Cell className={`px-4 py-3 text-right font-mono font-medium ${getReturnColorClass(signal.return10D)}`}>
                        {formatPercent(signal.return10D)}
                      </Table.Cell>
                      <Table.Cell className={`px-4 py-3 text-right font-mono font-medium ${getReturnColorClass(signal.return20D)}`}>
                        {formatPercent(signal.return20D)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
              {results.signals.length > 50 && (
                <div className="px-4 py-3 bg-white/5 border-t border-white/5 text-center text-xs text-slate-500">
                  Showing top 50 of {results.signals.length} signals
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function StatsCard({ label, value, colorClass = 'text-white', className = '' }) {
  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
      <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">{label}</span>
      <span className={`block font-mono font-bold ${colorClass} ${className}`}>{value}</span>
    </div>
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
