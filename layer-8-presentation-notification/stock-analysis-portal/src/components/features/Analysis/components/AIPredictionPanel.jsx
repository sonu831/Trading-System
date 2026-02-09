import React from 'react';
import PropTypes from 'prop-types';
import { Badge, Card } from '@/components/ui';

/**
 * AIPredictionPanel Component
 * Displays AI prediction with gauge, confidence, and reasoning
 */
export default function AIPredictionPanel({ data, loading, error, onFetch }) {
  const renderSkeleton = () => (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-5 backdrop-blur-sm animate-pulse">
      <div className="flex justify-between items-center mb-6">
        <div className="h-4 w-32 bg-slate-800 rounded"></div>
        <div className="h-6 w-20 bg-slate-800 rounded-full"></div>
      </div>
      <div className="flex justify-center mb-6">
        <div className="w-32 h-32 rounded-full border-4 border-slate-800 bg-transparent"></div>
      </div>
      <div className="h-3 w-full bg-slate-800 rounded mb-2"></div>
      <div className="h-3 w-2/3 bg-slate-800 rounded"></div>
    </div>
  );

  if (loading) {
    return renderSkeleton();
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 border border-rose-500/30 rounded-xl p-5 backdrop-blur-sm flex flex-col items-center justify-center text-center">
        <h3 className="text-sm font-bold text-slate-100 mb-4 uppercase tracking-wide">AI Prediction</h3>
        <span className="text-2xl mb-3">⚠</span>
        <p className="text-rose-400 text-sm mb-4">{error}</p>
        {onFetch && (
          <button
            onClick={onFetch}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-5 backdrop-blur-sm flex flex-col items-center justify-center text-center h-full">
        <h3 className="text-sm font-bold text-slate-100 mb-6 uppercase tracking-wide">AI Prediction</h3>
        <span className="text-4xl mb-3 opacity-50">🤖</span>
        <p className="text-slate-400 text-sm mb-6">Click to get AI prediction based on technical indicators</p>
        {onFetch && (
          <button
            onClick={onFetch}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5"
          >
            Get Prediction
          </button>
        )}
      </div>
    );
  }

  const { prediction, confidence, reasoning, modelVersion } = data;
  const isBullish = prediction > 0.5;
  const percentage = (prediction * 100).toFixed(1);
  const gaugeAngle = prediction * 180 - 90; // -90 to 90 degrees

  return (
    <div className="bg-slate-900/50 border border-white/10 rounded-xl p-5 backdrop-blur-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">AI Prediction</h3>
        <Badge variant={isBullish ? 'success' : 'error'} size="md">
          {isBullish ? '▲ Bullish' : '▼ Bearish'}
        </Badge>
      </div>

      <div className="flex justify-center mb-6">
        <div className="relative w-44">
          <svg viewBox="0 0 200 120" className="w-full h-auto overflow-visible">
            {/* Background arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#1e293b" // slate-800
              strokeWidth="16"
              strokeLinecap="round"
            />
            {/* Gradient arc */}
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" /> {/* rose-500 */}
                <stop offset="50%" stopColor="#f59e0b" /> {/* amber-500 */}
                <stop offset="100%" stopColor="#10b981" /> {/* emerald-500 */}
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
              stroke="#e2e8f0" // slate-200
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${gaugeAngle}, 100, 100)`}
            />
            <circle cx="100" cy="100" r="6" fill="#e2e8f0" />
          </svg>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 text-center">
            <span className="text-2xl font-bold font-mono text-white">{percentage}%</span>
          </div>
          <div className="absolute top-full left-0 w-full flex justify-between px-2 mt-2">
            <span className="text-[10px] text-rose-400 font-bold uppercase">Bearish</span>
            <span className="text-[10px] text-emerald-400 font-bold uppercase">Bullish</span>
          </div>
        </div>
      </div>

      <div className="mb-4 mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-slate-400 font-medium uppercase">Confidence</span>
          <span className="text-xs font-bold text-slate-200">{confidence?.toFixed(0) || 0}%</span>
        </div>
        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {reasoning && (
        <div className="bg-black/20 rounded-lg p-3 border border-white/5 mb-2 flex-grow">
          <span className="block text-xs text-slate-500 font-bold uppercase mb-1">Analysis</span>
          <p className="text-sm text-slate-300 leading-relaxed">{reasoning}</p>
        </div>
      )}

      {modelVersion && (
        <div className="text-right">
          <span className="text-[10px] text-slate-600 font-mono">Model: {modelVersion}</span>
        </div>
      )}
    </div>
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
