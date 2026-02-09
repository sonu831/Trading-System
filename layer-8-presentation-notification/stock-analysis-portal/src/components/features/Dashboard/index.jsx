import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MarketOverview from './components/MarketOverview';
import TopMovers from './components/TopMovers';
import NiftyGrid from './components/NiftyGrid';
import SignalsFeed from './components/SignalsFeed';
import DashboardSkeleton from './components/DashboardSkeleton';
import { EmptyState } from '@/components/common';
import { Button } from '@/components/ui';
import TopPicksWidget from './components/TopPicksWidget';

const DashboardView = ({ marketView, signals, loading }) => {
  const [activeTab, setActiveTab] = useState('GRID'); // GRID | SIGNALS

  if (loading || !marketView) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Live Market Overview */}
      {!marketView || !marketView.all_stocks || marketView.all_stocks.length === 0 ? (
        <EmptyState
          icon="📡"
          title="Waiting for Market Data..."
          description="The system is online but hasn't processed any market data yet. Trigger a feed update to see live stats."
          actionLabel="Refresh Data"
          onAction={() => window.location.reload()}
          className="border border-white/10 rounded-xl bg-white/5 backdrop-blur-sm"
        />
      ) : (
        <>
          <MarketOverview marketView={marketView} />
          <TopPicksWidget marketView={marketView} />
        </>
      )}

      {/* Top Movers Carousel */}
      <TopMovers marketView={marketView} />

      {/* Main Content Tabs */}
      <div>
        <div className="flex items-center gap-6 mb-6 border-b border-white/10">
          <button
            onClick={() => setActiveTab('GRID')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'GRID'
                ? 'border-b-2 border-indigo-500 text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Nifty 50 Grid
          </button>
          <button
            onClick={() => setActiveTab('SIGNALS')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all ${
              activeTab === 'SIGNALS'
                ? 'border-b-2 border-indigo-500 text-indigo-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Live Signals ({signals?.length || 0})
          </button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'GRID' && <NiftyGrid marketView={marketView} />}
          {activeTab === 'SIGNALS' && <SignalsFeed signals={signals} />}
        </div>
      </div>
    </div>
  );
};

DashboardView.propTypes = {
  marketView: PropTypes.object,
  signals: PropTypes.array,
  loading: PropTypes.bool,
};

export default DashboardView;
