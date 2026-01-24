import React from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { setBackfillModalOpen } from '@/store/slices/systemSlice';
import { ThemeToggle } from '../../ui';

import Link from 'next/link';

const Navbar = ({ viewMode, setViewMode, systemStatus = 'ONLINE' }) => {
  const dispatch = useDispatch();

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
        <ThemeToggle />

        <div className="flex items-center gap-4">
          <button
            onClick={() => dispatch(setBackfillModalOpen(true))}
            disabled={systemStatus === 'OFFLINE'}
            className={`
              relative group overflow-hidden px-5 py-2 rounded-lg font-bold text-sm transition-all duration-300 shadow-md transform hover:-translate-y-0.5
              ${
                systemStatus === 'OFFLINE'
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white hover:shadow-indigo-500/25 border border-indigo-400/20'
              }
            `}
            title="Manage Historical Data"
          >
            <div className="relative z-10 flex items-center gap-2">
              <span className="text-lg">📥</span>
              <span>Backfill Manager</span>
            </div>
            {/* Hover Glow Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-400/0 via-white/20 to-indigo-400/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
          </button>

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
