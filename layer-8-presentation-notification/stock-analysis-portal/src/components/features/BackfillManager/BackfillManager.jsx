import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Card, Button, Badge, Table, Modal, Input } from '../../ui';
import SwarmMonitor from './SwarmMonitor';

/**
 * BackfillManager Component
 * Displays data coverage for all symbols with status indicators and backfill actions
 */
export default function BackfillManager({
  symbols,
  loading,
  error,
  summary,
  laggingSymbols,
  selectedSymbol,
  isDialogOpen,
  backfillInProgress,
  message,
  sortConfig,
  onSort,
  onRefresh,
  onTriggerBackfill,
  onTriggerBulkBackfill,
  onOpenDialog,
  onCloseDialog,
  onClearMessage,
}) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [bulkFromDate, setBulkFromDate] = useState('');
  const [bulkToDate, setBulkToDate] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkBackfillMode, setBulkBackfillMode] = useState('missing');
  const [forceRefetch, setForceRefetch] = useState(false);

  // Initialize dates on mount
  React.useEffect(() => {
    const today = new Date();
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);

    setToDate(today.toISOString().split('T')[0]);
    setFromDate(yearAgo.toISOString().split('T')[0]);
    setBulkToDate(today.toISOString().split('T')[0]);
    setBulkFromDate(yearAgo.toISOString().split('T')[0]);
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const variants = {
      healthy: { variant: 'success', label: '✓ Synced' },
      warning: { variant: 'warning', label: '⚠ Partial' },
      critical: { variant: 'error', label: '✗ Lagging' },
    };
    const { variant, label } = variants[status] || variants.critical;
    return <Badge variant={variant} size="sm">{label}</Badge>;
  };

  const getRowClass = (status) => {
    if (status === 'critical') return 'bg-error/5 hover:bg-error/10';
    if (status === 'warning') return 'bg-warning/5 hover:bg-warning/10';
    return 'hover:bg-surface-hover';
  };

  // Sort indicator
  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return null;
    return (
      <span className="ml-1">
        {sortConfig.direction === 'asc' ? '▲' : '▼'}
      </span>
    );
  };

  const handleBackfillSubmit = () => {
    if (selectedSymbol && fromDate && toDate) {
      onTriggerBackfill(selectedSymbol, fromDate, toDate, forceRefetch);
    }
  };

  const handleBulkBackfillSubmit = () => {
    if (bulkFromDate && bulkToDate) {
      onTriggerBulkBackfill(bulkFromDate, bulkToDate, bulkBackfillMode, forceRefetch);
      setShowBulkModal(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border bg-surface p-8">
        <div className="flex items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-text-secondary">Loading data coverage...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-border bg-surface p-8">
        <div className="text-center">
          <div className="text-error text-xl mb-2">❌ Error Loading Data</div>
          <p className="text-text-secondary mb-4">{error}</p>
          <Button variant="outline" onClick={onRefresh}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <Card className="border-border bg-surface">
        <div className="p-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                📊 Backfill Manager
              </h1>
              <p className="text-text-secondary text-sm mt-1">
                Monitor and manage historical data coverage for Nifty 50 symbols
              </p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="primary" 
                onClick={() => setShowBulkModal(true)}
                disabled={laggingSymbols.length === 0}
                size="sm"
              >
                🚀 Bulk Backfill ({laggingSymbols.length})
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-background/50 p-4 rounded-lg border border-border text-center">
              <div className="text-3xl font-bold text-text-primary">{summary.totalSymbols}</div>
              <div className="text-xs text-text-tertiary uppercase tracking-wider">Total Symbols</div>
            </div>
            <div className="bg-success/10 p-4 rounded-lg border border-success/30 text-center">
              <div className="text-3xl font-bold text-success">{summary.healthyCount}</div>
              <div className="text-xs text-success/80 uppercase tracking-wider">Healthy</div>
            </div>
            <div className="bg-warning/10 p-4 rounded-lg border border-warning/30 text-center">
              <div className="text-3xl font-bold text-warning">{summary.warningCount}</div>
              <div className="text-xs text-warning/80 uppercase tracking-wider">Warning</div>
            </div>
            <div className="bg-error/10 p-4 rounded-lg border border-error/30 text-center">
              <div className="text-3xl font-bold text-error">{summary.criticalCount}</div>
              <div className="text-xs text-error/80 uppercase tracking-wider">Critical</div>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg border border-primary/30 text-center">
              <div className="text-2xl font-bold text-primary">{summary.totalCandles.toLocaleString()}</div>
              <div className="text-xs text-primary/80 uppercase tracking-wider">Total Candles</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-lg flex justify-between items-center ${
            message.type === 'success'
              ? 'bg-success/20 text-success border border-success/30'
              : message.type === 'error'
                ? 'bg-error/20 text-error border border-error/30'
                : 'bg-info/20 text-info border border-info/30'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={onClearMessage} className="text-current opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* SWARM MONITOR (Live Visibility) */}
      <SwarmMonitor onRefresh={onRefresh} />

      {/* Data Grid */}
      <Card className="border-border bg-surface overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold text-text-primary">📈 Symbol Coverage</h2>
          <p className="text-xs text-text-tertiary mt-1">
            Click column headers to sort • Symbols with &lt;50k candles need attention
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <Table hoverable>
            <Table.Header>
              <Table.Row className="bg-background">
                <Table.HeaderCell 
                  className="px-4 py-3 cursor-pointer hover:bg-surface-hover"
                  onClick={() => onSort('symbol')}
                >
                  Symbol <SortIndicator columnKey="symbol" />
                </Table.HeaderCell>
                <Table.HeaderCell 
                  className="px-4 py-3 cursor-pointer hover:bg-surface-hover"
                  onClick={() => onSort('earliest')}
                >
                  Earliest Date <SortIndicator columnKey="earliest" />
                </Table.HeaderCell>
                <Table.HeaderCell 
                  className="px-4 py-3 cursor-pointer hover:bg-surface-hover"
                  onClick={() => onSort('latest')}
                >
                  Latest Date <SortIndicator columnKey="latest" />
                </Table.HeaderCell>
                <Table.HeaderCell 
                  className="px-4 py-3 cursor-pointer hover:bg-surface-hover"
                  onClick={() => onSort('total_candles')}
                >
                  Candles <SortIndicator columnKey="total_candles" />
                </Table.HeaderCell>
                <Table.HeaderCell className="px-4 py-3">Status</Table.HeaderCell>
                <Table.HeaderCell className="px-4 py-3 text-right">Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {symbols.map((item) => (
                <Table.Row key={item.symbol} className={getRowClass(item.status)}>
                  <Table.Cell className="px-4 py-3">
                    <span className="font-bold text-primary">{item.symbol}</span>
                  </Table.Cell>
                  <Table.Cell className="px-4 py-3 text-text-secondary font-mono text-sm">
                    {formatDate(item.earliest)}
                  </Table.Cell>
                  <Table.Cell className="px-4 py-3 text-text-secondary font-mono text-sm">
                    {formatDate(item.latest)}
                  </Table.Cell>
                  <Table.Cell className="px-4 py-3">
                    <span className={`font-mono font-bold ${
                      item.status === 'healthy' ? 'text-success' : 
                      item.status === 'warning' ? 'text-warning' : 'text-error'
                    }`}>
                      {(item.total_candles || 0).toLocaleString()}
                    </span>
                  </Table.Cell>
                  <Table.Cell className="px-4 py-3">
                    {getStatusBadge(item.status)}
                  </Table.Cell>
                  <Table.Cell className="px-4 py-3 text-right">
                    <Button
                      variant={item.status === 'critical' ? 'danger' : 'outline'}
                      size="sm"
                      onClick={() => onOpenDialog(item.symbol)}
                      disabled={backfillInProgress[item.symbol]}
                      loading={backfillInProgress[item.symbol]}
                    >
                      {backfillInProgress[item.symbol] ? 'Running...' : '📥 Backfill'}
                    </Button>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>

        <div className="p-4 border-t border-border text-center text-text-tertiary text-sm">
          Showing {symbols.length} of {summary.totalSymbols} symbols
        </div>
      </Card>

      {/* Single Symbol Backfill Modal */}
      <Modal isOpen={isDialogOpen} onClose={onCloseDialog} size="md">
        <Modal.Header onClose={onCloseDialog}>
          📥 Backfill {selectedSymbol}
        </Modal.Header>
        <Modal.Body>
          <p className="text-text-secondary mb-4">
            Fetch historical 1-minute candle data for <strong className="text-primary">{selectedSymbol}</strong>.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              required
            />
            <Input
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              required
            />
          </div>

          {/* Force Refetch Option */}
          <div className="mt-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={forceRefetch}
                onChange={(e) => setForceRefetch(e.target.checked)}
                className="rounded border-border bg-surface text-primary focus:ring-primary"
              />
              <span className="text-sm text-text-primary">
                <strong>Force Refetch</strong> (Overwrite existing data)
              </span>
            </label>
          </div>
          <p className="text-xs text-text-tertiary mt-4">
            ⚠️ Large date ranges may take several minutes. Check Telegram for progress updates.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onCloseDialog}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleBackfillSubmit}
            disabled={!fromDate || !toDate}
          >
            🚀 Start Backfill
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Backfill Modal */}
      <Modal 
        isOpen={showBulkModal} 
        onClose={() => setShowBulkModal(false)} 
        size="md"
      >
        <Modal.Header onClose={() => setShowBulkModal(false)}>
          🚀 Bulk Backfill Manager
        </Modal.Header>
        <Modal.Body>
          {/* Mode Selection */}
          <div className="mb-6 space-y-3">
            <label className="text-sm font-bold text-text-primary block mb-2">Backfill Scope</label>
            
            {/* Option A: Missing Only */}
            <div 
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                bulkBackfillMode === 'missing' 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-background border-border hover:bg-surface-hover'
              }`}
              onClick={() => setBulkBackfillMode('missing')}
            >
              <div className="flex items-center gap-3">
                <input 
                  type="radio" 
                  checked={bulkBackfillMode === 'missing'}
                  onChange={() => setBulkBackfillMode('missing')}
                  className="w-4 h-4 text-primary"
                />
                <div>
                  <div className="font-bold text-text-primary">Backfill Missing Only (Recommended)</div>
                  <div className="text-xs text-text-secondary">
                    Only process the <strong className="text-warning">{laggingSymbols.length}</strong> lagging symbols.
                    Safe and fast.
                  </div>
                </div>
              </div>
            </div>

            {/* Option B: All Symbols */}
            <div 
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                bulkBackfillMode === 'all' 
                  ? 'bg-primary/10 border-primary' 
                  : 'bg-background border-border hover:bg-surface-hover'
              }`}
              onClick={() => setBulkBackfillMode('all')}
            >
              <div className="flex items-center gap-3">
                <input 
                  type="radio" 
                  checked={bulkBackfillMode === 'all'}
                  onChange={() => setBulkBackfillMode('all')}
                  className="w-4 h-4 text-primary"
                />
                <div>
                  <div className="font-bold text-text-primary">Backfill ALL Symbols</div>
                  <div className="text-xs text-text-secondary">
                    Process all {symbols.length} Nifty 50 symbols.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conditional Warning for ALL */}
          {bulkBackfillMode === 'all' && (
            <div className="mb-4 bg-error/10 border border-error/30 p-3 rounded-lg flex gap-3 items-start">
              <span className="text-2xl">⚠️</span>
              <div className="text-xs text-error">
                <strong className="block text-sm mb-1">Time Warning</strong>
                Pulling all records for a large time frame (e.g., 1 year) will take <strong>~2 hours</strong>. 
                Proceed with caution as this puts load on the ingestion system.
              </div>
            </div>
          )}

          {/* Force Refetch Option */}
          <div className="mb-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input 
                type="checkbox" 
                checked={forceRefetch}
                onChange={(e) => setForceRefetch(e.target.checked)}
                className="rounded border-border bg-surface text-primary focus:ring-primary"
              />
              <span className="text-sm text-text-primary">
                <strong>Force Refetch</strong> (Overwrite existing data)
              </span>
            </label>
            <p className="text-xs text-text-tertiary ml-6 mt-1">
              Check this if you want to re-download data even if the DB says it exists.
            </p>
          </div>

          {/* Date Selection */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              label="From Date"
              type="date"
              value={bulkFromDate}
              onChange={(e) => setBulkFromDate(e.target.value)}
              required
            />
            <Input
              label="To Date"
              type="date"
              value={bulkToDate}
              onChange={(e) => setBulkToDate(e.target.value)}
              required
            />
          </div>

          {/* Preview of Symbols (Only if Missing Mode) */}
          {bulkBackfillMode === 'missing' && laggingSymbols.length > 0 && (
            <div className="mb-4">
              <label className="text-xs text-text-secondary block mb-2">Target Symbols:</label>
              <div className="bg-background/50 p-2 rounded border border-border max-h-24 overflow-y-auto flex flex-wrap gap-1">
                {laggingSymbols.map((s) => (
                  <Badge 
                    key={s.symbol} 
                    variant={s.status === 'critical' ? 'error' : 'warning'} 
                    size="xs"
                  >
                    {s.symbol}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleBulkBackfillSubmit}
            disabled={!bulkFromDate || !bulkToDate}
          >
            {bulkBackfillMode === 'all' 
              ? `🚀 Start Bulk Backfill (ALL)` 
              : `🚀 Backfill ${laggingSymbols.length} Symbols`}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

BackfillManager.propTypes = {
  symbols: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  summary: PropTypes.object.isRequired,
  laggingSymbols: PropTypes.array.isRequired,
  selectedSymbol: PropTypes.string,
  isDialogOpen: PropTypes.bool.isRequired,
  backfillInProgress: PropTypes.object.isRequired,
  message: PropTypes.object,
  sortConfig: PropTypes.object.isRequired,
  onSort: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  onTriggerBackfill: PropTypes.func.isRequired,
  onTriggerBulkBackfill: PropTypes.func.isRequired,
  onOpenDialog: PropTypes.func.isRequired,
  onCloseDialog: PropTypes.func.isRequired,
  onClearMessage: PropTypes.func.isRequired,
};
