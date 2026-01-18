import React, { useState } from 'react';

const NiftyGrid = React.memo(({ marketView }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const stocks = marketView?.all_stocks || [];
  const filteredStocks = stocks.filter((stock) =>
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white">Nifty 50 Live Watch</h2>
        <input
          type="text"
          placeholder="Search Symbol..."
          className="bg-gray-900 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-900 text-gray-400 uppercase text-xs font-semibold">
            <tr>
              <th className="px-4 py-3 rounded-tl-lg">Symbol</th>
              <th className="px-4 py-3 text-right">LTP</th>
              <th className="px-4 py-3 text-right">Change %</th>
              <th className="px-4 py-3 text-center">RSI</th>
              <th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-center rounded-tr-lg">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 text-sm">
            {filteredStocks.length > 0 ? (
              filteredStocks.map((stock) => (
                <tr
                  key={stock.symbol}
                  className="hover:bg-gray-700/50 transition cursor-pointer group"
                >
                  <td className="px-4 py-3 font-bold text-blue-400 group-hover:text-blue-300">
                    {stock.symbol}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">
                    ₹{stock.ltp.toFixed(2)}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-bold ${stock.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {stock.change_pct > 0 ? '+' : ''}
                    {stock.change_pct.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                        stock.rsi > 70
                          ? 'bg-red-900/50 text-red-300'
                          : stock.rsi < 30
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {stock.rsi.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 font-mono">
                    {(stock.volume / 1000).toFixed(1)}k
                  </td>
                  <td className="px-4 py-3 text-center">
                    {/* Simple Trend Icon */}
                    {stock.change_pct > 0.5 ? (
                      <span className="text-green-500">▲ Bullish</span>
                    ) : stock.change_pct < -0.5 ? (
                      <span className="text-red-500">▼ Bearish</span>
                    ) : (
                      <span className="text-gray-500">─ Neutral</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-8 text-center text-gray-500 italic">
                  {stocks.length === 0 ? 'Waiting for market data...' : 'No matching stocks found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default NiftyGrid;
