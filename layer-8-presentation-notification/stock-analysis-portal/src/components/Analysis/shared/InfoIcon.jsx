import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import INDICATOR_METADATA from './indicatorMetadata';

/**
 * InfoIcon Component
 * ℹ️ icon button that opens a slide-over panel showing indicator details.
 * Uses STATIC metadata + ALREADY-FETCHED indicator data — no extra API call needed.
 *
 * Props:
 *  - indicatorKey: 'rsi' | 'macd' | 'ema' | 'supertrend' | 'bb' | 'adx' | 'stochastic'
 *  - indicators: the indicators object from useAnalysis (already fetched)
 *  - factorData: optional factor data from multi-TF verdict (contribution, reason)
 */
export default function InfoIcon({ indicatorKey, indicators, factorData }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render portal client-side (Next.js SSR safety)
  useEffect(() => {
    setMounted(true);
  }, []);

  const meta = INDICATOR_METADATA[indicatorKey];
  if (!meta) return null;

  // Extract current value using the static accessor
  const rawValue = meta.getValue(indicators);
  const state = meta.getState(rawValue);
  const displayValue = meta.formatValue(rawValue);

  // Color coding for state
  const getStateColor = (s) => {
    const sl = (s || '').toLowerCase();
    if (sl.includes('bullish') || sl.includes('oversold') || sl.includes('strong trend')) return 'text-emerald-400';
    if (sl.includes('bearish') || sl.includes('overbought')) return 'text-rose-400';
    return 'text-amber-400';
  };

  const getStateBg = (s) => {
    const sl = (s || '').toLowerCase();
    if (sl.includes('bullish') || sl.includes('oversold') || sl.includes('strong trend')) return 'bg-emerald-500/20';
    if (sl.includes('bearish') || sl.includes('overbought')) return 'bg-rose-500/20';
    return 'bg-amber-500/20';
  };

  // Panel content (rendered via portal)
  const panelContent = open && mounted ? ReactDOM.createPortal(
    <div
      className="fixed inset-0 flex justify-end"
      style={{ zIndex: 9999 }}
      onClick={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-sm bg-slate-900 border-l border-white/10 shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: 'infoSlideIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur-md border-b border-white/10 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">{meta.name}</h3>
          <button
            onClick={() => setOpen(false)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Current State Badge */}
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${getStateBg(state)} ${getStateColor(state)}`}>
              {state}
            </span>
            <span className="text-xs text-slate-500">Current State</span>
          </div>

          {/* Current Value */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Current Value</div>
            <div className="text-lg font-mono font-bold text-white">
              {displayValue}
            </div>
          </div>

          {/* Description */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">What It Measures</div>
            <p className="text-xs text-slate-300 leading-relaxed">{meta.description}</p>
          </div>

          {/* Formula */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Formula</div>
            <code className="text-xs text-indigo-300 bg-slate-800/80 px-2 py-1.5 rounded block font-mono leading-relaxed">
              {meta.formula}
            </code>
          </div>

          {/* Parameters */}
          {meta.parameters && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Parameters</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(meta.parameters).map(([key, val]) => (
                  <span key={key} className="text-xs bg-slate-800/60 border border-white/5 rounded px-2 py-1 text-slate-300">
                    <span className="text-slate-500">{key}: </span>
                    <span className="font-mono">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Interpretation Zones */}
          {meta.zones && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">Interpretation Zones</div>
              <div className="space-y-1.5">
                {Object.entries(meta.zones).map(([zone, desc]) => (
                  <div key={zone} className="flex items-start gap-2 text-xs">
                    <span className="text-indigo-400 font-mono shrink-0 mt-0.5">•</span>
                    <div>
                      <span className="text-slate-200 font-medium">{zone}</span>
                      <span className="text-slate-500 ml-1">— {desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scoring Rule */}
          <div className="bg-slate-800/60 rounded-lg p-3 border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Verdict Scoring</div>
            <p className="text-xs text-slate-300 leading-relaxed">{meta.scoring}</p>
            <p className="text-xs text-slate-500 mt-1">Max contribution: ±{meta.maxScore}</p>
          </div>

          {/* Factor Data (from Multi-TF verdict) */}
          {factorData && (
            <div className="bg-indigo-500/10 rounded-lg p-3 border border-indigo-500/20">
              <div className="text-[10px] uppercase tracking-wider text-indigo-400 mb-1">Factor Contribution</div>
              <div className="flex items-center gap-3">
                <span className={`text-xl font-bold font-mono ${
                  factorData.contribution > 0 ? 'text-emerald-400' :
                  factorData.contribution < 0 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {factorData.contribution > 0 ? '+' : ''}{factorData.contribution}
                </span>
                <span className="text-xs text-slate-500">/ ±{meta.maxScore}</span>
              </div>
              {factorData.reason && (
                <p className="text-xs text-slate-400 mt-1">{factorData.reason}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen(true);
        }}
        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full
                   bg-white/10 hover:bg-indigo-500/30 text-slate-400 hover:text-indigo-400
                   transition-all duration-200 cursor-pointer"
        title={`About ${meta.name}`}
        aria-label={`Info about ${meta.name}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
          <path fillRule="evenodd" d="M15 8A7 7 0 1 1 1 8a7 7 0 0 1 14 0Zm-6 3.5a1 1 0 1 1-2 0v-3a1 1 0 1 1 2 0v3ZM8 5.5A.75.75 0 1 0 8 4a.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Portal-rendered panel */}
      {panelContent}
    </>
  );
}

InfoIcon.propTypes = {
  indicatorKey: PropTypes.string.isRequired,
  indicators: PropTypes.object,
  factorData: PropTypes.shape({
    contribution: PropTypes.number,
    reason: PropTypes.string,
  }),
};
