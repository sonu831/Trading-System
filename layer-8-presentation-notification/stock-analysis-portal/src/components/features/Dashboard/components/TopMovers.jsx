import React from 'react';
import PropTypes from 'prop-types';
import { Carousel } from '@/components/ui';

const StockCard = ({ title, symbol, value, subValue, type }) => {
  const getValueColor = () => {
    switch (type) {
      case 'bull':
        return 'text-success';
      case 'bear':
        return 'text-error';
      default:
        return 'text-info';
    }
  };

  return (
    <div className="min-w-[160px] bg-background p-3 rounded-lg border border-border flex flex-col snap-center hover:bg-surface-hover transition cursor-pointer group">
      <div className="text-xs text-text-tertiary mb-1 group-hover:text-text-secondary">{title}</div>
      <div className="font-bold text-text-primary text-lg">{symbol}</div>
      <div className={`font-mono text-sm font-bold ${getValueColor()}`}>{value}</div>
      <div className="text-xs text-text-tertiary mt-1">{subValue}</div>
    </div>
  );
};

StockCard.propTypes = {
  title: PropTypes.string,
  symbol: PropTypes.string,
  value: PropTypes.string,
  subValue: PropTypes.string,
  type: PropTypes.oneOf(['bull', 'bear', 'neutral']),
};

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

TopMovers.propTypes = {
  marketView: PropTypes.shape({
    all_stocks: PropTypes.arrayOf(
      PropTypes.shape({
        symbol: PropTypes.string,
        change_pct: PropTypes.number,
        ltp: PropTypes.number,
      })
    ),
    sector_performance: PropTypes.object,
  }),
};

export default TopMovers;
