import React from 'react';
import PropTypes from 'prop-types';
import { Card, Badge } from '@/components/ui';

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

  const getSentimentVariant = (s) => {
    if (s === 'Bullish' || s === 'bullish') return 'success';
    if (s === 'Bearish' || s === 'bearish') return 'error';
    return 'warning';
  };

  const formatNumber = (num) => {
    if (num === undefined || num === null) return 'N/A';
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)} K`;
    return num.toFixed(0);
  };

  const getPCRColorClass = (val) => {
    if (val > 1) return 'text-emerald-400';
    if (val < 0.7) return 'text-rose-400';
    return 'text-amber-400';
  };

  return (
    <Card className="h-full">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Options Analysis</h3>
        {sentiment && (
          <Badge variant={getSentimentVariant(sentiment)} size="md">
            {sentiment}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900/50 border border-indigo-500/30 rounded-lg p-3 text-center backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50"></div>
          <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">PCR (OI)</span>
          <span className={`block text-xl font-mono font-bold ${getPCRColorClass(pcr)}`}>
            {pcr?.toFixed(2) || 'N/A'}
          </span>
          <span className="block text-[10px] text-slate-500 mt-1">
            {pcr > 1 ? 'Bullish' : pcr < 0.7 ? 'Bearish' : 'Neutral'}
          </span>
        </div>

        <div className="bg-slate-900/50 border border-white/10 rounded-lg p-3 text-center backdrop-blur-sm">
          <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">PCR (Vol)</span>
          <span className="block text-xl font-mono font-bold text-slate-200">
            {pcrVolume?.toFixed(2) || 'N/A'}
          </span>
        </div>

        {maxPain && (
          <div className="bg-slate-900/50 border border-indigo-500/30 rounded-lg p-3 text-center backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1 h-full bg-indigo-500/50"></div>
            <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Max Pain</span>
            <span className="block text-xl font-mono font-bold text-slate-200">
              {maxPain.toLocaleString()}
            </span>
            <span className="block text-[10px] text-slate-500 mt-1">Strike</span>
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* OI Breakdown */}
        <div>
          <div className="text-xs text-slate-500 font-bold uppercase mb-2">Open Interest Breakdown</div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-12 text-xs text-slate-400 font-medium">Put OI</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${putOI && callOI ? (putOI / (putOI + callOI)) * 100 : 50}%`,
                  }}
                />
              </div>
              <span className="w-16 text-right text-xs font-mono text-slate-300">{formatNumber(putOI)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-12 text-xs text-slate-400 font-medium">Call OI</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full"
                  style={{
                    width: `${putOI && callOI ? (callOI / (putOI + callOI)) * 100 : 50}%`,
                  }}
                />
              </div>
              <span className="w-16 text-right text-xs font-mono text-slate-300">{formatNumber(callOI)}</span>
            </div>
          </div>
        </div>

        {/* Volume Breakdown */}
        {(putVolume || callVolume) && (
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase mb-2">Volume Breakdown</div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Put Vol:</span>
                <span className="text-sm font-mono font-bold text-emerald-400">{formatNumber(putVolume)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Call Vol:</span>
                <span className="text-sm font-mono font-bold text-rose-400">{formatNumber(callVolume)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
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
