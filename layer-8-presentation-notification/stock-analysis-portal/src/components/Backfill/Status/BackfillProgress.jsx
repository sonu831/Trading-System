import React from 'react';
import PropTypes from 'prop-types';

/**
 * Visualizes the backfill progress with raw counts and status indicators.
 *
 * @component
 * @param {Object} props
 * @param {string|number} props.status - Current status ('running', 'completed', 'failed', or numeric)
 * @param {number} props.progress - The raw count of rows synced (not percentage)
 * @param {string} props.details - Status message or details
 * @param {Array<string>} props.logs - Real-time logs from the backfill process
 * @param {Function} props.onClose - Callback to dismiss the progress view
 */
const BackfillProgress = ({ status, progress, details, logs, onClose }) => {
  const isRunning = status === 'running' || status === 1;
  const isCompleted = status === 'completed' || status === 2;
  const isFailed = status === 'failed' || status === 3;

  // Format big numbers (e.g., 1,234,567)
  const formattedCount = new Intl.NumberFormat('en-US').format(progress || 0);

  if (isRunning) {
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
                {details || 'Syncing candles...'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-2xl font-bold text-primary leading-none font-mono">
              {formattedCount}
            </span>
            <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
              Rows Synced
            </span>
          </div>
        </div>

        {/* Real-time Logs Terminal */}
        <div className="mb-4 bg-gray-950 rounded-lg border border-gray-800 p-3 font-mono text-[10px] md:text-xs h-32 overflow-y-auto shadow-inner custom-scrollbar">
          {logs && logs.length > 0 ? (
            logs.map((log, index) => (
              <div
                key={index}
                className="text-gray-300 border-b border-gray-900/50 pb-0.5 mb-0.5 last:border-0"
              >
                <span className="text-indigo-400 mr-2">➜</span>
                {log}
              </div>
            ))
          ) : (
            <div className="text-gray-500 italic text-center mt-10">Waiting for log stream...</div>
          )}
        </div>

        {/* Indeterminate Progress Bar (Since we don't know total) */}
        <div className="w-full bg-background/50 rounded-full h-1 overflow-hidden">
          <div className="h-full bg-indigo-500 w-full origin-left animate-progress-indeterminate"></div>
        </div>
        <div className="flex justify-end mt-1">
           <span className="text-[10px] text-text-tertiary">
            Updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    );
  }

  if (isCompleted) {
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-success text-sm">Success</h3>
            <span className="text-text-secondary text-xs">
              Backfill Completed. Total Rows: {formattedCount}
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

  if (isFailed) {
    return (
      <div className="bg-error/10 border border-error/30 p-4 rounded-xl flex items-center justify-between mb-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="text-error p-2 bg-error/10 rounded-full">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-error text-sm">Failed</h3>
            <span className="text-text-secondary text-xs">{details || 'Backfill encountered an error.'}</span>
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
  status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  progress: PropTypes.number,
  details: PropTypes.string,
  logs: PropTypes.array,
  onClose: PropTypes.func,
};

export default BackfillProgress;
