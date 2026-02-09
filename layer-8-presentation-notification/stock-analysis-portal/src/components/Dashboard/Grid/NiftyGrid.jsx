import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { DataTable, Card } from '@/components/ui';

const NiftyGrid = React.memo(({ marketView }) => {
  const stocks = useMemo(() => marketView?.all_stocks || [], [marketView]);

  const columns = useMemo(
    () => [
      {
        key: 'symbol',
        label: 'Symbol',
        sortable: true,
        filterable: true,
        className: 'font-bold pl-6',
        render: (val) => (
          <a
            href={`/analysis/${val}`}
            className="text-slate-100 hover:text-indigo-400 hover:underline transition-colors font-bold"
          >
            {val}
          </a>
        ),
      },
      {
        key: 'ltp',
        label: 'LTP',
        sortable: true,
        className: 'text-right font-mono',
        render: (val) => `₹${val.toFixed(2)}`,
      },
      {
        key: 'change_pct',
        label: 'Change %',
        sortable: true,
        className: 'text-right',
        render: (val) => (
          <span className={`font-bold ${val >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {val > 0 ? '+' : ''}
            {val.toFixed(2)}%
          </span>
        ),
      },
      {
        key: 'rsi',
        label: 'RSI',
        sortable: true,
        className: 'text-center',
        render: (val) => (
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
              val > 70
                ? 'bg-rose-500/10 text-rose-400'
                : val < 30
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-white/5 text-slate-400'
            }`}
          >
            {val.toFixed(1)}
          </span>
        ),
      },
      {
        key: 'volume',
        label: 'Volume',
        sortable: true,
        className: 'text-right font-mono text-slate-500',
        render: (val) => `${(val / 1000).toFixed(1)}k`,
      },
      {
        key: 'trend',
        label: 'Trend',
        sortable: false,
        className: 'text-center',
        render: (_, row) => {
          if (row.change_pct > 0.5) return <span className="text-emerald-400 text-xs">▲ Bullish</span>;
          if (row.change_pct < -0.5) return <span className="text-rose-400 text-xs">▼ Bearish</span>;
          return <span className="text-slate-500 text-xs">─ Neutral</span>;
        },
      },
    ],
    []
  );

  return (
    <Card variant="glass" padding="none">
      <div className="p-4 border-b border-white/5">
        <h2 className="text-lg font-bold text-slate-100">Nifty 50 Live Watch</h2>
      </div>

      <DataTable
        columns={columns}
        data={stocks}
        pagination={useMemo(() => ({ pageSize: 10 }), [])}
        className="min-h-[400px]"
      />
    </Card>
  );
});

NiftyGrid.displayName = 'NiftyGrid';

NiftyGrid.propTypes = {
  marketView: PropTypes.shape({
    all_stocks: PropTypes.array,
  }),
};

export default NiftyGrid;
