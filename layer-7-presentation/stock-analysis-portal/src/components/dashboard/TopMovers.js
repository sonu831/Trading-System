import React from 'react';
import Carousel from './Carousel';

const StockCard = ({ title, symbol, value, subValue, type }) => (
  <div className="min-w-[160px] bg-gray-750 p-3 rounded-lg border border-gray-600 flex flex-col snap-center hover:bg-gray-700 transition cursor-pointer">
    <div className="text-xs text-gray-400 mb-1">{title}</div>
    <div className="font-bold text-white text-lg">{symbol}</div>
    <div
      className={`font-mono text-sm font-bold ${type === 'bull' ? 'text-green-400' : type === 'bear' ? 'text-red-400' : 'text-blue-400'}`}
    >
      {value}
    </div>
    <div className="text-xs text-gray-500 mt-1">{subValue}</div>
  </div>
);

const TopMovers = ({ marketView }) => {
  if (!marketView || !marketView.all_stocks) return null;

  const stocks = [...marketView.all_stocks];
  const sectors = marketView.sector_performance ? Object.values(marketView.sector_performance) : [];

  // Sort for Gainers and Losers
  const gainers = [...stocks].sort((a, b) => b.change_pct - a.change_pct).slice(0, 5);
  const losers = [...stocks].sort((a, b) => a.change_pct - b.change_pct).slice(0, 5);

  // Sort Sectors
  const topSectors = [...sectors].sort((a, b) => b.average_change - a.average_change).slice(0, 3);
  const bottomSectors = [...sectors]
    .sort((a, b) => a.average_change - b.average_change)
    .slice(0, 3);

  return (
    <Carousel title="🔥 Market Highlights & Top Movers">
      {/* Top Sectors */}
      {topSectors.map((s) => (
        <StockCard
          key={`sec-win-${s.name}`}
          title="Top Sector"
          symbol={s.name}
          value={`${s.average_change > 0 ? '+' : ''}${s.average_change.toFixed(2)}%`}
          subValue="Avg Change"
          type="bull"
        />
      ))}

      {/* Top Gainers */}
      {gainers.map((s) => (
        <StockCard
          key={`stock-win-${s.symbol}`}
          title="Top Gainer"
          symbol={s.symbol}
          value={`+${s.change_pct.toFixed(2)}%`}
          subValue={`₹${s.ltp.toFixed(2)}`}
          type="bull"
        />
      ))}

      {/* Bottom Sectors */}
      {bottomSectors.map((s) => (
        <StockCard
          key={`sec-loss-${s.name}`}
          title="Lagging Sector"
          symbol={s.name}
          value={`${s.average_change.toFixed(2)}%`}
          subValue="Avg Change"
          type="bear"
        />
      ))}

      {/* Top Losers */}
      {losers.map((s) => (
        <StockCard
          key={`stock-loss-${s.symbol}`}
          title="Top Loser"
          symbol={s.symbol}
          value={`${s.change_pct.toFixed(2)}%`}
          subValue={`₹${s.ltp.toFixed(2)}`}
          type="bear"
        />
      ))}
    </Carousel>
  );
};

export default TopMovers;
