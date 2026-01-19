import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MarketOverview from './components/MarketOverview';
import TopMovers from './components/TopMovers';
import NiftyGrid from './components/NiftyGrid';
import SignalsFeed from './components/SignalsFeed';
import DashboardSkeleton from './components/DashboardSkeleton';
import { Button } from '@/components/ui';
import { BackfillModal } from '@/components/features/Backfill';

const DashboardView = ({ marketView, signals, loading }) => {
  const [activeTab, setActiveTab] = useState('GRID'); // GRID | SIGNALS
  const [showBackfill, setShowBackfill] = useState(false);

  if (loading || !marketView) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Live Market Overview */}
      <MarketOverview marketView={marketView} />

      {/* Top Movers Carousel */}
      <TopMovers marketView={marketView} />

      {/* Main Content Tabs */}
      <div className="flex overflow-x-auto no-scrollbar mb-4 border-b border-border whitespace-nowrap">
        <button
          onClick={() => setActiveTab('GRID')}
          className={`px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'GRID'
              ? 'border-primary text-primary bg-surface/50 rounded-t-lg'
              : 'border-transparent text-text-tertiary hover:text-text-primary'
          }`}
        >
          Nifty 50 Grid
        </button>
        <button
          onClick={() => setActiveTab('SIGNALS')}
          className={`px-4 md:px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'SIGNALS'
              ? 'border-accent text-accent bg-surface/50 rounded-t-lg'
              : 'border-transparent text-text-tertiary hover:text-text-primary'
          }`}
        >
          Live Signals ({signals.length})
        </button>
        <button
          onClick={() => setShowBackfill(true)}
          className="px-4 md:px-6 py-3 text-sm font-medium border-b-2 border-transparent text-text-tertiary hover:text-text-primary flex items-center gap-2"
        >
          📥 Backfill Data
        </button>
        <a
          href="/system"
          className="px-4 md:px-6 py-3 text-sm font-medium border-b-2 border-transparent text-text-tertiary hover:text-text-primary"
        >
          System Visualizer
        </a>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px] md:min-h-[500px]">
        {activeTab === 'GRID' && <NiftyGrid marketView={marketView} />}
        {activeTab === 'SIGNALS' && <SignalsFeed signals={signals} />}
      </div>

      {/* Backfill Modal */}
      <BackfillModal isOpen={showBackfill} onClose={() => setShowBackfill(false)} />
    </div>
  );
};

DashboardView.propTypes = {
  marketView: PropTypes.object,
  signals: PropTypes.array,
  loading: PropTypes.bool,
};

export default DashboardView;
