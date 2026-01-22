import React from 'react';
import { Card } from '@/components/ui';
import MarketTrendChart from './components/MarketTrendChart';

const HistoricalView = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">Historical Performance Analysis</h2>
          </div>

          <MarketTrendChart />

          <div className="mt-4 text-center text-sm text-text-tertiary">
            Showing last 7 days performance (Simulated Data). Connect TSDB for real history.
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">Backtest Results</h2>
          </div>

          <Card className="p-10 text-center border-border">
            <div className="text-text-tertiary italic">
              Backtesting module not initialized. Select a strategy to run backtest.
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default HistoricalView;
