import React from 'react';

const MarketOverview = ({ marketView }) => {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
      {/* Market Sentiment Card */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 relative overflow-hidden group hover:border-blue-500/50 transition duration-300">
        <div className="absolute -right-6 -top-6 text-9xl opacity-5 grayscale group-hover:grayscale-0 group-hover:opacity-10 transition duration-500 select-none">
          {marketView?.breadth?.market_sentiment === 'BULLISH'
            ? '🐂'
            : marketView?.breadth?.market_sentiment === 'BEARISH'
              ? '🐻'
              : '⚖️'}
        </div>

        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
          Market Sentiment
        </h3>
        <div
          className={`text-4xl font-extrabold flex items-center gap-3 ${
            marketView?.breadth?.market_sentiment === 'BULLISH'
              ? 'text-green-400'
              : marketView?.breadth?.market_sentiment === 'BEARISH'
                ? 'text-red-400'
                : 'text-yellow-400'
          }`}
        >
          <span className="animate-bounce-slow text-4xl">
            {marketView?.breadth?.market_sentiment === 'BULLISH'
              ? '🐂'
              : marketView?.breadth?.market_sentiment === 'BEARISH'
                ? '🐻'
                : '😐'}
          </span>
          <span>{marketView?.breadth?.market_sentiment || 'NEUTRAL'}</span>
        </div>
        <div className="text-xs text-gray-500 mt-2 font-mono">
          Updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Advance / Decline Meter */}
      <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700 hover:border-purple-500/50 transition duration-300">
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-2">
          Advance / Decline
        </h3>
        <div className="flex items-end justify-between mb-2">
          <div>
            <div className="text-3xl font-extrabold text-white">
              {marketView?.breadth?.advance_decline_ratio?.toFixed(2) || '0.00'}
            </div>
            <div className="text-xs text-gray-400">Ratio</div>
          </div>
          <div className="text-right text-xs font-bold">
            <div className="text-green-400">{marketView?.breadth?.advances} Advances 🟢</div>
            <div className="text-red-400">{marketView?.breadth?.declines} Declines 🔴</div>
          </div>
        </div>
        {/* Improved Meter */}
        <div className="relative h-4 bg-gray-900 rounded-full overflow-hidden shadow-inner border border-gray-700">
          {/* Center Marker */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 z-10"></div>

          <div className="flex h-full w-full">
            <div
              className="bg-gradient-to-r from-green-900 to-green-500 h-full transition-all duration-700 ease-out"
              style={{ width: `${(marketView?.breadth?.advances / 50) * 100}%` }}
            ></div>
            <div
              className="bg-gradient-to-l from-red-900 to-red-500 h-full transition-all duration-700 ease-out"
              style={{ width: `${(marketView?.breadth?.declines / 50) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MarketOverview;
