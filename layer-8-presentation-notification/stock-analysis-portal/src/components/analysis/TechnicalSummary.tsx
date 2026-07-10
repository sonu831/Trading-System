import React from 'react';

export default function TechnicalSummary({ data }) {
  if (!data) return null;

  const { rsi, macd, ema50, ema200, trend_score } = data;

  return (
    <div className="bg-surface p-6 rounded-lg border border-border shadow-lg">
      <h3 className="text-xl font-bold text-white mb-4">Technical Indicators</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* RSI */}
        <div className="bg-background p-4 rounded border border-gray-700">
          <div className="text-gray-400 text-sm">RSI (14)</div>
          <div className={`text-2xl font-bold ${rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-green-400' : 'text-white'}`}>
            {rsi ? rsi.toFixed(2) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral'}
          </div>
        </div>

        {/* MACD */}
        <div className="bg-background p-4 rounded border border-gray-700">
          <div className="text-gray-400 text-sm">MACD</div>
          <div className={`text-2xl font-bold ${macd?.histogram > 0 ? 'text-green-400' : 'text-red-400'}`}>
            {macd?.histogram ? macd.histogram.toFixed(2) : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {macd?.histogram > 0 ? 'Bullish' : 'Bearish'} Momentum
          </div>
        </div>

        {/* Trend */}
        <div className="bg-background p-4 rounded border border-gray-700">
          <div className="text-gray-400 text-sm">Trend (EMA)</div>
          <div className={`text-2xl font-bold ${ema50 > ema200 ? 'text-green-400' : 'text-red-400'}`}>
             {ema50 && ema200 ? (ema50 > ema200 ? 'Bullish' : 'Bearish') : 'N/A'}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            EMA 50 vs 200
          </div>
        </div>

        {/* Overall Score */}
        <div className="bg-background p-4 rounded border border-gray-700">
          <div className="text-gray-400 text-sm">Trend Score</div>
          <div className="text-2xl font-bold text-yellow-400">
            {trend_score !== undefined ? trend_score : '0'} / 10
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Composite Signal
          </div>
        </div>
      </div>
    </div>
  );
}
