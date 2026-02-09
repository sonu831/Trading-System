import React from 'react';
import PropTypes from 'prop-types';
import { Input, Button } from '@/components/ui';

export const BackfillForm = ({
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  symbol,
  setSymbol,
  force,
  setForce,
  onSubmit,
  loading,
  isActive,
  maxDays,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="bg-white/5 p-4 rounded-xl border border-white/10 mb-4 backdrop-blur-sm shadow-inner"
    >
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <Input
          label="From Date"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          required
          className="flex-1 bg-slate-800 border-slate-700 focus:border-indigo-500"
        />
        <Input
          label="To Date"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          required
          className="flex-1 bg-slate-800 border-slate-700 focus:border-indigo-500"
        />
        <Input
          label="Symbol (optional)"
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value.toUpperCase())}
          placeholder="e.g., RELIANCE"
          helperText="Leave empty for all Nifty 50 stocks"
          className="flex-1 bg-slate-800 border-slate-700 focus:border-indigo-500"
        />
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          id="force-backfill"
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
          className="w-4 h-4 text-indigo-500 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500"
        />
        <label htmlFor="force-backfill" className="text-sm text-slate-400 select-none cursor-pointer">
          Force Refetch (Overwrite existing data)
        </label>
      </div>

      <Button
        type="submit"
        disabled={loading || isActive}
        loading={loading}
        className={`w-full transition-all shadow-lg ${
          isActive
            ? 'bg-slate-700 border border-slate-600 text-slate-400 cursor-not-allowed'
            : force
            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20'
            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-900/20'
        }`}
      >
        {loading
          ? 'Starting...'
          : isActive
          ? '⏳ Backfill in Progress...'
          : force
          ? '⚠️ Force Start Backfill'
          : '🚀 Start Backfill'}
      </Button>
      <p className="text-xs text-slate-500 mt-2">
        Max {maxDays} days range. {force && <span className="text-rose-400">Warning: Force mode will re-download data.</span>}
      </p>
    </form>
  );
};

BackfillForm.propTypes = {
  fromDate: PropTypes.string.isRequired,
  setFromDate: PropTypes.func.isRequired,
  toDate: PropTypes.string.isRequired,
  setToDate: PropTypes.func.isRequired,
  symbol: PropTypes.string,
  setSymbol: PropTypes.func.isRequired,
  force: PropTypes.bool.isRequired,
  setForce: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  isActive: PropTypes.bool,
  maxDays: PropTypes.number,
};
