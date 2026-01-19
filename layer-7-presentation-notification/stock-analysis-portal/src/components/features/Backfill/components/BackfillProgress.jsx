import React from 'react';
import PropTypes from 'prop-types';

const BackfillProgress = ({ status, progress, details, onClose }) => {
  if (status === 'running') {
    return (
      <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl relative overflow-hidden mb-6 shadow-[0_0_15px_rgba(99,102,241,0.1)]">
        <div className="flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4 mb-3">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="p-2 bg-indigo-600 rounded-lg animate-pulse shrink-0 text-white shadow-lg shadow-indigo-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
                Historical Backfill in Progress
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              </h3>
              <p className="text-indigo-300 font-mono text-xs md:text-sm mt-1 animate-pulse">
                {details || 'Syncing indices...'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-bold text-primary leading-none">{progress}%</span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Progress
            </span>
          </div>
        </div>

        <div className="w-full bg-background/50 rounded-full h-2.5 overflow-hidden shadow-inner border border-black/5 dark:border-white/5">
          <div
            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(99,102,241,0.4)] relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute top-0 right-0 bottom-0 w-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12"></div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'completed') {
    return (
      <div className="bg-success/10 border border-success/30 p-4 rounded-xl flex items-center justify-between mb-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-success p-2 bg-success/10 rounded-full">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-success text-sm">Success</h3>
            <span className="text-text-secondary text-xs">
              Historical Backfill Completed Successfully
            </span>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary text-xs font-bold uppercase tracking-wider px-2 py-1 rounded hover:bg-surface"
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return null;
};

BackfillProgress.propTypes = {
  status: PropTypes.string,
  progress: PropTypes.number,
  details: PropTypes.string,
  onClose: PropTypes.func,
};

export default BackfillProgress;
