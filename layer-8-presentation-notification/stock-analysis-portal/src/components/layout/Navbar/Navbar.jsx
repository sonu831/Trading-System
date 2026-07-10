import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { setBackfillModalOpen } from '@/store/slices/systemSlice';
import { fetchExecutionState, selectTradeMode } from '@/store/slices/executionSlice';
import { ThemeToggle } from '../../ui';
import { TradeModeBadge, KillSwitchButton } from '@/components/trading';

import Link from 'next/link';

const Navbar = ({ viewMode, setViewMode, systemStatus = 'ONLINE' }) => {
  const dispatch = useDispatch();
  const tradeMode = useSelector(selectTradeMode);

  // Dashboard rules U1/U2: the kill switch and the trade mode must be reachable and
  // visible on EVERY route, so the Navbar owns polling the execution state.
  useEffect(() => {
    dispatch(fetchExecutionState());
    const id = setInterval(() => dispatch(fetchExecutionState()), 5000);
    return () => clearInterval(id);
  }, [dispatch]);

  return (
    // ... (in Navbar component)

    <header className="mb-6 bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col md:flex-row justify-between items-center transition-colors duration-200">
      <Link href="/" className="cursor-pointer group">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent tracking-tight group-hover:opacity-80 transition-opacity">
            Stock Analysis By Gurus
          </h1>
          <p className="text-text-secondary text-xs md:text-sm mt-1 font-light tracking-wide group-hover:text-white transition-colors">
            India's First Complex to Simple AI Driven Stock Analysis Application
          </p>
        </div>
      </Link>

      <div className="flex items-center space-x-4 mt-4 md:mt-0">
        {/* U1 + U2: kill switch and trade mode are visible on every route, incl. mobile. */}
        <div className="flex items-center gap-3 order-first md:order-none">
          <TradeModeBadge mode={tradeMode || undefined} />
          <KillSwitchButton />
        </div>

        <ThemeToggle />

        <div className="flex items-center gap-4">
          <Link
            href="/trading"
            className={`
              relative group overflow-hidden px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 shadow-md transform hover:-translate-y-0.5
              bg-gradient-to-r from-sky-600 to-sky-500 text-white hover:shadow-sky-500/25 border border-sky-400/20
            `}
            title="Positions, P&L and risk"
          >
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-lg">📈</span>
              <span>Trading</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-sky-400/0 via-white/20 to-sky-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
          </Link>

          <Link
            href="/backfill"
            className={`
              relative group overflow-hidden px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 shadow-md transform hover:-translate-y-0.5
              ${
                systemStatus === 'OFFLINE'
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none pointer-events-none'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:shadow-emerald-500/25 border border-emerald-400/20'
              }
            `}
            title="Manage Data"
          >
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-lg">📥</span>
              <span>Backfill Data</span>
            </div>
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/0 via-white/20 to-emerald-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
          </Link>

          <Link
            href="/brokers"
            className={`
              relative group overflow-hidden px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 shadow-md transform hover:-translate-y-0.5
              bg-gradient-to-r from-purple-600 to-purple-500 text-white hover:shadow-purple-500/25 border border-purple-400/20
            `}
            title="Broker Credentials"
          >
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-lg">🔑</span>
              <span>Brokers</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/0 via-white/20 to-purple-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
          </Link>

          <Link
            href="/swarm"
            className={`
              relative group overflow-hidden px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 shadow-md transform hover:-translate-y-0.5
              ${
                systemStatus === 'OFFLINE'
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none pointer-events-none'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-indigo-500/25 border border-indigo-400/20'
              }
            `}
            title="Swarm Monitor"
          >
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-lg">🐝</span>
              <span>Swarm Monitor</span>
            </div>
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/0 via-white/20 to-indigo-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
          </Link>

          <div className="flex bg-background border border-border rounded-lg p-1 gap-1">
            <button
              onClick={() => setViewMode('LIVE')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'LIVE' ? 'bg-secondary text-white shadow' : 'text-text-tertiary hover:text-text-primary'}`}
            >
              LIVE
            </button>
            <button
              onClick={() => setViewMode('HISTORICAL')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'HISTORICAL' ? 'bg-accent text-white shadow' : 'text-text-tertiary hover:text-text-primary'}`}
            >
              HISTORICAL
            </button>
          </div>
        </div>
        <div className="text-right hidden md:block">
          <div className="text-xs text-text-tertiary uppercase tracking-wider">System Status</div>
          <div className="flex items-center justify-end space-x-2">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${systemStatus === 'ONLINE' ? 'bg-success' : 'bg-error'}`}
            ></span>
            <span
              className={`text-sm font-mono ${systemStatus === 'ONLINE' ? 'text-success' : 'text-error'}`}
            >
              {systemStatus}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

Navbar.propTypes = {
  viewMode: PropTypes.string,
  setViewMode: PropTypes.func,
  systemStatus: PropTypes.string,
};

export default Navbar;
