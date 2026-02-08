import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { setBackfillModalOpen } from '@/store/slices/systemSlice';
import { ThemeToggle } from '../../ui';
import NotificationBell from '../../features/Notifications/NotificationBell';

import Link from 'next/link';

const Navbar = ({ viewMode, setViewMode, systemStatus = 'ONLINE' }) => {
  const dispatch = useDispatch();

  return (
    // ... (in Navbar component)

    <header className="sticky top-4 z-40 mb-6 bg-surface p-4 rounded-xl shadow-lg border border-border flex flex-col md:flex-row justify-between items-center transition-colors duration-200">
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
        <NotificationBell />
        <ThemeToggle />

        {/* Global Refresh Button */}
        <button
          onClick={async () => {
            const btn = document.getElementById('global-refresh-btn');
            if (btn) btn.classList.add('animate-spin');
            
            try {
              // 1. Clear Redis Cache
              await fetch('/api/v1/system/cache/clear', { method: 'POST' });
              // 2. Trigger DB Sync
              await fetch('/api/v1/jobs/datasync/trigger', { method: 'POST' });
              
              // 3. Reload Page to fetch fresh data
              window.location.reload();
            } catch (e) {
              console.error('Refresh Failed', e);
              if (btn) btn.classList.remove('animate-spin');
            }
          }}
          className="p-2 rounded-lg bg-surface border border-border hover:bg-surface-hover text-text-secondary hover:text-primary transition-colors"
          title="Global Cache Refresh"
        >
          <svg 
            id="global-refresh-btn"
            xmlns="http://www.w3.org/2000/svg" 
            className="h-5 w-5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <div className="flex items-center gap-4">
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

          {setViewMode && (
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
          )}
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
