import React from 'react';
import Link from 'next/link';

const TopPicksWidget = ({ marketView }) => {
  const picks = marketView?.smartPicks || [];
  const summary = marketView?.marketSummary;

  if (picks.length === 0 && !summary) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">🎯</span>
        <h2 className="text-lg font-bold text-white uppercase tracking-wider">
          AI Insight & Top Picks
        </h2>
        <span className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded-full animate-pulse">
          LIVE
        </span>
      </div>

      {summary && (
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 border border-blue-500/30 p-4 rounded-xl mb-4 shadow-lg">
          <h3 className="text-blue-400 font-bold mb-1 text-sm uppercase">
            🤖 &nbsp; AI Market Analysis
          </h3>
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">{summary}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.isArray(picks) &&
          picks.map((pick, i) => {
            // Safety check for pick object
            if (!pick || typeof pick !== 'object') return null;
            const score = typeof pick.score === 'number' ? pick.score : 0;
            const rsi = typeof pick.rsi === 'number' ? pick.rsi : 0;
            const symbol = pick.symbol || 'UNKNOWN';
            const trend = pick.trend || 'N/A';

            return (
              <Link href={`/${symbol}`} key={`${symbol}-${i}`} className="block group">
                <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-blue-500 transition-all cursor-pointer">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-bold text-lg text-white group-hover:text-blue-400">
                      {symbol}
                    </span>
                    <span
                      className={`text-xs px-2 py-1 rounded font-bold ${score > 0 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}
                    >
                      {score.toFixed(2)}
                    </span>
                  </div>

                  <div className="text-sm text-gray-400 mb-2">
                    RSI: <span className="text-white">{rsi.toFixed(1)}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-mono text-gray-500">
                    <span>{trend}</span>
                  </div>
                </div>
              </Link>
            );
          })}
      </div>
    </div>
  );
};

export default TopPicksWidget;
