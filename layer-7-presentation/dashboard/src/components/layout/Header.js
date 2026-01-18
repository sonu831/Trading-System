import React from 'react';

const Header = ({ viewMode, setViewMode, systemStatus = 'ONLINE' }) => {
  return (
    <header className="mb-6 bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700 flex flex-col md:flex-row justify-between items-center">
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500 tracking-tight">
          Stock Analysis By Gurus
        </h1>
        <p className="text-gray-400 text-xs md:text-sm mt-1 font-light tracking-wide">
          India's First Complex to Simple AI Driven Stock Analysis Application
        </p>
      </div>

      <div className="flex items-center space-x-4 mt-4 md:mt-0">
        <div className="flex bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setViewMode('LIVE')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'LIVE' ? 'bg-green-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}
          >
            LIVE MARKET
          </button>
          <button
            onClick={() => setViewMode('HISTORICAL')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${viewMode === 'HISTORICAL' ? 'bg-purple-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}
          >
            HISTORICAL
          </button>
        </div>
        <div className="text-right hidden md:block">
          <div className="text-xs text-gray-500 uppercase tracking-wider">System Status</div>
          <div className="flex items-center justify-end space-x-2">
            <span
              className={`w-2 h-2 rounded-full animate-pulse ${systemStatus === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}`}
            ></span>
            <span
              className={`text-sm font-mono ${systemStatus === 'ONLINE' ? 'text-green-400' : 'text-red-400'}`}
            >
              {systemStatus}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
