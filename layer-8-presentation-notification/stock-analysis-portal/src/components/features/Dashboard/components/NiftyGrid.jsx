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
        className: 'font-bold text-primary',
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
          <span className={`font-bold ${val >= 0 ? 'text-success' : 'text-error'}`}>
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
                ? 'bg-error/20 text-error'
                : val < 30
                  ? 'bg-success/20 text-success'
                  : 'bg-surface text-text-tertiary'
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
        className: 'text-right font-mono text-text-tertiary',
        render: (val) => `${(val / 1000).toFixed(1)}k`,
      },
      {
        key: 'trend',
        label: 'Trend',
        sortable: false, // Calculated field, might be tricky to sort unless mapped
        className: 'text-center',
        render: (_, row) => {
          if (row.change_pct > 0.5) return <span className="text-success text-xs">▲ Bullish</span>;
          if (row.change_pct < -0.5) return <span className="text-error text-xs">▼ Bearish</span>;
          return <span className="text-text-tertiary text-xs">─ Neutral</span>;
        },
      },
    ],
    []
  );

  return (
    <Card className="p-4 border-border bg-surface">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-text-primary">Nifty 50 Live Watch</h2>
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
