import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Components
import Layout from '../components/layout/Layout';
import MarketOverview from '../components/dashboard/MarketOverview';
import TopMovers from '../components/dashboard/TopMovers';
import NiftyGrid from '../components/dashboard/NiftyGrid';
import SkeletonLoader from '../components/dashboard/SkeletonLoader';
import SignalsFeed from '../components/dashboard/SignalsFeed';
import MarketTrendChart from '../components/charts/MarketTrendChart';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export default function Home() {
  const [marketView, setMarketView] = useState(null);
  const [signals, setSignals] = useState([]);
  const [systemStatus, setSystemStatus] = useState('OFFLINE');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('GRID'); // GRID | SIGNALS
  const [viewMode, setViewMode] = useState('LIVE'); // LIVE | HISTORICAL

  const fetchData = async () => {
    try {
      // 1. Fetch Market View
      const marketRes = await axios.get(`${API_URL}/market-view`);
      setMarketView(marketRes.data);
      setSystemStatus('ONLINE'); // If fetch succeeds, system is likely online

      // 2. Fetch Signals
      const signalsRes = await axios.get(`${API_URL}/signals`);
      setSignals(signalsRes.data);

      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch data', err);
      // setSystemStatus('OFFLINE'); // Optional: toggle offline if all fail
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // Faster polling for "Live" feel
    return () => clearInterval(interval);
  }, []);

  if (loading || !marketView) {
    return (
      <Layout viewMode={viewMode} setViewMode={setViewMode} systemStatus={systemStatus}>
        <SkeletonLoader />
      </Layout>
    );
  }

  return (
    <Layout viewMode={viewMode} setViewMode={setViewMode} systemStatus={systemStatus}>
      {viewMode === 'LIVE' ? (
        <>
          {/* Live Market Overview */}
          <MarketOverview marketView={marketView} />

          {/* Top Movers Carousel */}
          <TopMovers marketView={marketView} />

          {/* Main Content Tabs */}
          <div className="flex space-x-1 mb-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('GRID')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'GRID' ? 'border-blue-500 text-blue-400 bg-gray-800 rounded-t-lg' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Nifty 50 Grid
            </button>
            <button
              onClick={() => setActiveTab('SIGNALS')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition ${activeTab === 'SIGNALS' ? 'border-purple-500 text-purple-400 bg-gray-800 rounded-t-lg' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
            >
              Live Signals ({signals.length})
            </button>
            <a
              href="/system"
              className="px-6 py-3 text-sm font-medium border-b-2 border-transparent text-gray-400 hover:text-gray-200"
            >
              System Visualizer
            </a>
          </div>

          {/* Tab Content */}
          <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 min-h-[500px]">
            {activeTab === 'GRID' && <NiftyGrid marketView={marketView} />}
            {activeTab === 'SIGNALS' && <SignalsFeed signals={signals} />}
          </div>
        </>
      ) : (
        /* Historical View */
        <div className="space-y-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Historical Performance Analysis</h2>
            <div className="h-96">
              <MarketTrendChart /> {/* Falls back to mock data for now */}
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              Showing last 7 days performance (Simulated Data). Connect TSDB for real history.
            </div>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-700">
            <h2 className="text-xl font-bold mb-4">Backtest Results</h2>
            <div className="text-gray-400 text-center py-10 italic">
              Backtesting module not initialized. Select a strategy to run backtest.
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
