import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Table } from '@/components/ui';

/**
 * EnhancedMultiTFSummary Component
 * Shows 6-timeframe analysis with indicators and 7-factor verdicts
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

  const getVerdictVariant = (signal) => {
    switch (signal) {
      case 'Strong Buy': return 'success';
      case 'Buy': return 'success';
      case 'Strong Sell': return 'error';
      case 'Sell': return 'error';
      default: return 'warning';
    }
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

  // Helper to get MACD histogram value
  const getMacdHist = (tf) => tf?.macdHist ?? tf?.macdHistogram ?? null;

  // Helper to get supertrend direction
  const getSupertrendDirection = (tf) => {
    if (!tf?.supertrend) return null;
    if (typeof tf.supertrend === 'string') return tf.supertrend;
    return tf.supertrend.direction;
  };

  // Helper to get BB position
  const getBBPosition = (tf) => {
    if (tf?.bbPosition !== undefined) return tf.bbPosition;
    const bbFactor = tf?.verdict?.factors?.bb?.position;
    if (bbFactor) {
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
    <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden backdrop-blur-sm">
      <div className="px-5 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
        <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wide">Multi-Timeframe Analysis</h3>
        {overallVerdict && (
          <Badge variant={getVerdictVariant(overallVerdict.signal)} size="md">
            {overallVerdict.signal} ({overallVerdict.confidence}%)
          </Badge>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
             <tr className="border-b border-white/5 bg-white/5 text-slate-400 uppercase text-xs tracking-wider font-semibold">
              <th className="px-5 py-3">Timeframe</th>
              <th className="px-5 py-3">RSI</th>
              <th className="px-5 py-3">MACD</th>
              <th className="px-5 py-3">Supertrend</th>
              <th className="px-5 py-3">BB Position</th>
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
              const bbPos = getBBPosition(tf);

              return (
                <tr key={interval} className="hover:bg-white/5 transition-colors">
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
                  <td className="px-5 py-3 font-mono">
                    {bbPos !== null ? `${(bbPos * 100).toFixed(0)}%` : 'N/A'}
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
