import React from 'react';
import PropTypes from 'prop-types';
import { Card, Table } from '@/components/ui';

export const BackfillCoverage = ({ coverage, loading }) => {
  const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A');

  if (loading) {
    return <p className="text-text-tertiary animate-pulse">Loading coverage data...</p>;
  }

  if (coverage.length === 0) {
    return <p className="text-text-tertiary">No historical data found. Run a backfill to populate.</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-lg font-bold text-text-secondary mb-3">📊 Current Data Coverage</h3>
      <div className="overflow-x-auto rounded-lg border border-white/5">
        <div className="flex gap-6 mb-3 p-3 bg-white/5 rounded border border-white/10 backdrop-blur-sm">
          <span className="text-slate-400 text-sm">
            Total Symbols: <strong className="text-slate-200">{coverage.length}</strong>
          </span>
          <span className="text-slate-400 text-sm">
            Total Candles:{' '}
            <strong className="text-slate-200">
              {coverage
                .reduce((sum, item) => sum + (item.total_candles || 0), 0)
                .toLocaleString()}
            </strong>
          </span>
        </div>
        <Table className="w-full">
          <Table.Header>
            <Table.Row className="bg-white/5 text-slate-400 uppercase text-xs">
              <Table.HeaderCell className="px-4 py-2">Symbol</Table.HeaderCell>
              <Table.HeaderCell className="px-4 py-2">Earliest</Table.HeaderCell>
              <Table.HeaderCell className="px-4 py-2">Latest</Table.HeaderCell>
              <Table.HeaderCell className="px-4 py-2">Candles</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body className="divide-y divide-white/5 text-sm">
            {coverage.slice(0, 10).map((item) => (
              <Table.Row key={item.symbol} className="hover:bg-white/5 transition-colors">
                <Table.Cell className="px-4 py-2 font-bold text-indigo-400">
                  {item.symbol}
                </Table.Cell>
                <Table.Cell className="px-4 py-2 text-slate-400">
                  {formatDate(item.earliest)}
                </Table.Cell>
                <Table.Cell className="px-4 py-2 text-slate-400">
                  {formatDate(item.latest)}
                </Table.Cell>
                <Table.Cell className="px-4 py-2 font-mono text-slate-300">
                  {item.total_candles?.toLocaleString()}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
        {coverage.length > 10 && (
          <p className="text-xs text-slate-500 mt-2 px-2">
            Showing 10 of {coverage.length} symbols
          </p>
        )}
      </div>
    </div>
  );
};

BackfillCoverage.propTypes = {
  coverage: PropTypes.array.isRequired,
  loading: PropTypes.bool,
};
