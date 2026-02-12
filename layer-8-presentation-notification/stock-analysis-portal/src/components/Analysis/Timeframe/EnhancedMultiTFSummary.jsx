import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Badge } from '@/components/ui';
import InfoIcon from '../shared/InfoIcon';

/**
 * EnhancedMultiTFSummary Component
 * Shows 6-timeframe analysis with indicators, 7-factor verdicts,
 * expandable factor breakdown rows, and confluence indicator.
 */
export default function EnhancedMultiTFSummary({ data }) {
  const [expanded, setExpanded] = useState({});

  // Handle both formats: { timeframes: {...} } or direct { '5m': {...}, '15m': {...} }
  const timeframes = data?.timeframes || data;
  const hasTimeframes = timeframes && Object.keys(timeframes).length > 0;

  const intervals = ['5m', '15m', '1h', '4h', '1d', '1w'];
  const intervalLabels = {
    '5m': '5 Min',
    '15m': '15 Min',
    '1h': '1 Hour',
    '4h': '4 Hour',
    '1d': 'Daily',
    '1w': 'Weekly',
  };

  // Factor display order and labels
  const factorOrder = ['rsi', 'macd', 'ema', 'supertrend', 'bb', 'adx', 'stochastic'];
  const factorLabels = {
    rsi: 'RSI',
    macd: 'MACD',
    ema: 'EMA',
    supertrend: 'SuperT',
    bb: 'BB',
    adx: 'ADX',
    stochastic: 'Stoch',
  };

  const toggleExpand = (interval) => {
    setExpanded((prev) => ({ ...prev, [interval]: !prev[interval] }));
  };

  // Calculate overall verdict from all timeframes
  const calculateOverallVerdict = () => {
    if (!timeframes) return null;
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

  // Confluence calculation
  const confluence = useMemo(() => {
    if (!timeframes) return null;
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;
    let total = 0;

    for (const interval of intervals) {
      const tf = timeframes[interval];
      if (!tf?.verdict?.signal) continue;
      total++;
      if (tf.verdict.signal.includes('Buy')) bullish++;
      else if (tf.verdict.signal.includes('Sell')) bearish++;
      else neutral++;
    }

    if (total === 0) return null;
    const dominant = bullish >= bearish ? 'Bullish' : 'Bearish';
    const maxCount = Math.max(bullish, bearish);
    const pct = Math.round((maxCount / total) * 100);

    return { bullish, bearish, neutral, total, dominant, pct };
  }, [timeframes]);

  // Early return AFTER all hooks
  if (!hasTimeframes) return null;

  const getVerdictVariant = (signal) => {
    if (!signal) return 'warning';
    if (signal.includes('Buy')) return 'success';
    if (signal.includes('Sell')) return 'error';
    return 'warning';
  };

  const getTrendIcon = (direction) => {
    if (direction === 1 || direction === 'up' || direction === 'Bullish') return '▲';
    if (direction === -1 || direction === 'down' || direction === 'Bearish') return '▼';
    return '●';
  };

  const getTrendColorClass = (direction) => {
    if (direction === 1 || direction === 'up' || direction === 'Bullish') return 'text-emerald-400';
    if (direction === -1 || direction === 'down' || direction === 'Bearish') return 'text-rose-400';
    return 'text-amber-400';
  };

  // Factor score → heatmap color
  const getFactorHeatColor = (score) => {
    switch (score) {
      case 2: return 'bg-emerald-500/80 text-emerald-50';
      case 1: return 'bg-emerald-500/40 text-emerald-200';
      case -1: return 'bg-rose-500/40 text-rose-200';
      case -2: return 'bg-rose-500/80 text-rose-50';
      default: return 'bg-slate-700/60 text-slate-400';
    }
  };

  // Helper to get MACD histogram value
  const getMacdHist = (tf) => tf?.macdHist ?? tf?.macdHistogram ?? null;

  // Helper to get supertrend direction
  const getSupertrendDirection = (tf) => {
    if (!tf?.supertrend) return null;
    if (typeof tf.supertrend === 'string') return tf.supertrend;
    return tf.supertrend.direction;
  };

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
      {/* Header with Overall Verdict */}
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">Multi-Timeframe Analysis</h3>
        {overallVerdict && (
          <Badge variant={getVerdictVariant(overallVerdict.signal)} size="md">
            {overallVerdict.signal} ({overallVerdict.confidence}%)
          </Badge>
        )}
      </div>

      {/* Confluence Indicator Bar */}
      {confluence && (
        <div className="px-5 py-3 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
              Timeframe Confluence
            </span>
            <span className="text-xs text-slate-400">
              <span className="font-mono font-bold text-emerald-400">{confluence.bullish}</span>
              <span className="text-slate-600 mx-1">↑</span>
              <span className="font-mono font-bold text-slate-400">{confluence.neutral}</span>
              <span className="text-slate-600 mx-1">•</span>
              <span className="font-mono font-bold text-rose-400">{confluence.bearish}</span>
              <span className="text-slate-600 mx-1">↓</span>
              <span className="text-slate-500 ml-1">of {confluence.total}</span>
            </span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/50">
            {confluence.bullish > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${(confluence.bullish / confluence.total) * 100}%` }}
              />
            )}
            {confluence.neutral > 0 && (
              <div
                className="bg-amber-500/60 transition-all duration-500"
                style={{ width: `${(confluence.neutral / confluence.total) * 100}%` }}
              />
            )}
            {confluence.bearish > 0 && (
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${(confluence.bearish / confluence.total) * 100}%` }}
              />
            )}
          </div>
          <div className="mt-1 text-[10px] text-slate-500 text-center">
            {confluence.pct}% {confluence.dominant} Agreement
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-white/5 text-slate-400 uppercase text-xs tracking-wider font-semibold">
              <th className="px-5 py-3 w-8"></th>
              <th className="px-5 py-3">Timeframe</th>
              <th className="px-5 py-3">RSI</th>
              <th className="px-5 py-3">MACD</th>
              <th className="px-5 py-3">Trend</th>
              <th className="px-5 py-3">Score</th>
              <th className="px-5 py-3">Verdict</th>
              <th className="px-5 py-3">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-slate-300">
            {intervals.map((interval) => {
              const tf = timeframes[interval];
              if (!tf) return null;

              const macdHist = getMacdHist(tf);
              const supertrendDir = getSupertrendDirection(tf);
              const isExpanded = expanded[interval];
              const factors = tf.verdict?.factors || {};
              const score = tf.verdict?.score;
              const maxScore = tf.verdict?.maxScore || 14;

              return (
                <React.Fragment key={interval}>
                  {/* Main Row — clickable */}
                  <tr
                    className={`hover:bg-white/5 transition-colors cursor-pointer select-none ${
                      isExpanded ? 'bg-white/[0.03]' : ''
                    }`}
                    onClick={() => toggleExpand(interval)}
                  >
                    {/* Expand indicator */}
                    <td className="px-3 py-3 text-slate-500 text-xs">
                      <span
                        className={`inline-block transition-transform duration-200 ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                      >
                        ▸
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-200">{intervalLabels[interval]}</td>
                    <td className="px-5 py-3 font-mono">
                      <span className={tf.rsi > 70 ? 'text-rose-400' : tf.rsi < 30 ? 'text-emerald-400' : ''}>
                        {tf.rsi?.toFixed(1) || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono">
                      <span className={macdHist > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {macdHist?.toFixed(2) || 'N/A'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-base">
                      <span className={getTrendColorClass(supertrendDir)}>
                        {getTrendIcon(supertrendDir)}
                      </span>
                    </td>
                    {/* Score column */}
                    <td className="px-5 py-3 font-mono text-sm">
                      <span
                        className={
                          score > 0
                            ? 'text-emerald-400'
                            : score < 0
                              ? 'text-rose-400'
                              : 'text-slate-400'
                        }
                      >
                        {score !== undefined ? `${score > 0 ? '+' : ''}${score}` : 'N/A'}
                      </span>
                      <span className="text-slate-600 text-xs">/{maxScore}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={getVerdictVariant(tf.verdict?.signal)} size="sm">
                        {tf.verdict?.signal || 'N/A'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="w-24 h-2 bg-slate-700/50 rounded-full overflow-hidden relative">
                        <div
                          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${
                            tf.verdict?.signal?.includes('Buy') ? 'bg-emerald-500' :
                            tf.verdict?.signal?.includes('Sell') ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${tf.verdict?.confidence || 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block text-center font-mono">
                        {tf.verdict?.confidence || 0}%
                      </span>
                    </td>
                  </tr>

                  {/* Expanded Factor Breakdown Row */}
                  {isExpanded && Object.keys(factors).length > 0 && (
                    <tr className="bg-slate-800/30">
                      <td colSpan="8" className="px-5 py-3">
                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mr-2">
                            Factors:
                          </span>
                          {factorOrder.map((key) => {
                            const factor = factors[key];
                            if (!factor && factor !== 0) return null;

                            const contribution = factor?.contribution ?? factor;
                            const reason = factor?.reason || '';

                            return (
                              <div
                                key={key}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono ${getFactorHeatColor(contribution)} cursor-pointer hover:ring-1 hover:ring-white/20 transition-all`}
                                title={reason}
                              >
                                <span className="font-sans font-semibold text-[10px] opacity-70">
                                  {factorLabels[key]}
                                </span>
                                <span className="font-bold">
                                  {contribution > 0 ? '+' : ''}{contribution}
                                </span>
                                <InfoIcon
                                  indicatorKey={key}
                                  factorData={{ contribution, reason }}
                                />
                              </div>
                            );
                          })}
                          {/* Total */}
                          <div className="ml-auto text-xs text-slate-500">
                            Σ = <span className={`font-mono font-bold ${score > 0 ? 'text-emerald-400' : score < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                              {score > 0 ? '+' : ''}{score}
                            </span>
                          </div>
                        </div>
                        {/* Factor reasons */}
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1">
                          {factorOrder.map((key) => {
                            const factor = factors[key];
                            if (!factor?.reason) return null;
                            return (
                              <div key={key} className="text-[10px] text-slate-500 truncate" title={factor.reason}>
                                <span className="text-slate-400">{factorLabels[key]}:</span> {factor.reason}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
