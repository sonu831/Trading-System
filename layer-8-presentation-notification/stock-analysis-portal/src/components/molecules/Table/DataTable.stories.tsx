import React from 'react';
import DataTable from './DataTable';
import Badge from '../../ui/Badge/Badge';

export default {
  title: 'Molecules/DataTable',
  component: DataTable,
  tags: ['autodocs'],
};

const columns = [
  { key: 'symbol', label: 'Symbol', sortable: true, filterable: true },
  { key: 'ltp', label: 'LTP', sortable: true },
  { key: 'changePct', label: 'Change %', sortable: true, render: (v) => (
    <span className={v > 0 ? 'text-success' : v < 0 ? 'text-error' : 'text-text-secondary'}>
      {v > 0 ? '+' : ''}{v}%
    </span>
  )},
  { key: 'volume', label: 'Volume', sortable: true },
  { key: 'signal', label: 'Signal', sortable: true, render: (v) => (
    <Badge variant={v === 'BUY' ? 'success' : v === 'SELL' ? 'error' : v === 'HOLD' ? 'info' : 'default'} size="sm">{v}</Badge>
  )},
];

const niftyData = [
  { id: 1, symbol: 'RELIANCE', ltp: '₹2,845.60', changePct: 1.24, volume: '3.2M', signal: 'BUY' },
  { id: 2, symbol: 'TCS', ltp: '₹3,921.15', changePct: -0.43, volume: '1.8M', signal: 'HOLD' },
  { id: 3, symbol: 'HDFCBANK', ltp: '₹1,634.80', changePct: 2.10, volume: '5.7M', signal: 'BUY' },
  { id: 4, symbol: 'INFY', ltp: '₹1,512.40', changePct: 0.89, volume: '2.3M', signal: 'HOLD' },
  { id: 5, symbol: 'ICICIBANK', ltp: '₹1,089.25', changePct: -1.15, volume: '4.1M', signal: 'SELL' },
  { id: 6, symbol: 'SBIN', ltp: '₹782.90', changePct: 0.56, volume: '6.5M', signal: 'BUY' },
  { id: 7, symbol: 'BHARTIARTL', ltp: '₹1,445.00', changePct: -0.78, volume: '1.2M', signal: 'HOLD' },
  { id: 8, symbol: 'ITC', ltp: '₹468.35', changePct: 0.22, volume: '8.1M', signal: 'HOLD' },
  { id: 9, symbol: 'KOTAKBANK', ltp: '₹1,812.60', changePct: 1.85, volume: '3.9M', signal: 'BUY' },
  { id: 10, symbol: 'LT', ltp: '₹3,245.80', changePct: -2.30, volume: '2.7M', signal: 'SELL' },
  { id: 11, symbol: 'AXISBANK', ltp: '₹1,098.50', changePct: 0.45, volume: '4.4M', signal: 'HOLD' },
  { id: 12, symbol: 'WIPRO', ltp: '₹475.20', changePct: -0.91, volume: '1.5M', signal: 'SELL' },
];

export const Default = {
  name: 'With data (12 rows)',
  args: { columns, data: niftyData },
};

export const WithPagination = {
  name: 'Paginated (5 per page)',
  args: {
    columns,
    data: niftyData,
    pagination: { currentPage: 1, totalPages: 3, totalItems: 12, pageSize: 5 },
  },
};

export const Loading = {
  name: 'Loading state',
  args: { columns, data: [], loading: true },
};

export const EmptyState = {
  name: 'Empty — no results',
  args: { columns, data: [] },
};

export const ManyRows = {
  name: 'Full feature demo',
  render: () => (
    <div style={{ width: '800px' }}>
      <DataTable columns={columns} data={niftyData} />
    </div>
  ),
};
