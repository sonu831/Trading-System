import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { DataTable, Badge, Card } from '@/components/ui';

// Utility for formatting time
const formatTime = (isoString) => {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const SignalsFeed = ({ signals = [] }) => {
  const columns = useMemo(
    () => [
      {
        key: 'timestamp',
        label: 'Time',
        sortable: true,
        className: 'text-sm text-text-secondary w-32',
        render: (val) => formatTime(val),
      },
      {
        key: 'symbol',
        label: 'Symbol',
        sortable: true,
        filterable: true,
        className: 'font-bold text-text-primary',
      },
      {
        key: 'action',
        label: 'Action',
        sortable: true,
        className: 'w-24',
        render: (val) => (
          <Badge variant={val === 'BUY' ? 'success' : 'error'} size="sm">
            {val}
          </Badge>
        ),
      },
      {
        key: 'price',
        label: 'Price',
        sortable: true,
        className: 'text-sm font-mono',
        render: (val) => `₹${val}`,
      },
      {
        key: 'strategy',
        label: 'Strategy',
        sortable: true,
        className: 'text-xs text-text-tertiary',
      },
      {
        key: 'confidence',
        label: 'Confidence',
        sortable: true,
        className: 'w-32',
        render: (val) => (
          <div className="w-full bg-background rounded-full h-2.5">
            <div className="bg-info h-2.5 rounded-full" style={{ width: `${val * 100}%` }} />
          </div>
        ),
      },
    ],
    []
  );

  return (
    <Card className="border-border p-0 overflow-hidden">
      <div className="p-4 border-b border-border bg-surface">
        <h2 className="text-lg font-bold text-text-primary">Live Signals</h2>
      </div>
      <DataTable columns={columns} data={signals} pagination={{ pageSize: 5 }} className="w-full" />
    </Card>
  );
};

SignalsFeed.propTypes = {
  signals: PropTypes.arrayOf(
    PropTypes.shape({
      timestamp: PropTypes.string,
      symbol: PropTypes.string,
      action: PropTypes.string,
      price: PropTypes.number,
      strategy: PropTypes.string,
      confidence: PropTypes.number,
    })
  ),
};

export default SignalsFeed;
