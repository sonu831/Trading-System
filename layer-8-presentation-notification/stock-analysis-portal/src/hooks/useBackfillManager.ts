import { useState, useEffect, useCallback } from 'react';

const API_URL = ''; // Uses proxy

const CANDLE_THRESHOLD = {
  HEALTHY: 50000, // > 50k candles = healthy
  WARNING: 20000, // 20k-50k = warning
  // < 20k = critical
};

/**
 * Custom hook for Backfill Manager page
 * Handles data fetching, state management, and backfill actions
 */
export default function useBackfillManager() {
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [backfillInProgress, setBackfillInProgress] = useState({});
  const [message, setMessage] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'total_candles', direction: 'asc' });

  // Fetch data availability
  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_URL}/api/v1/data/availability`);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch data availability');
      }

      const symbolsData = (data.data?.symbols || []).map((item) => ({
        ...item,
        total_candles: item.total_candles || 0,
        status: getSymbolStatus(item.total_candles || 0),
      }));

      setSymbols(symbolsData);
      setError(null);
    } catch (e) {
      console.error('Failed to fetch coverage:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  // Determine status based on candle count
  const getSymbolStatus = (candleCount) => {
    if (candleCount >= CANDLE_THRESHOLD.HEALTHY) return 'healthy';
    if (candleCount >= CANDLE_THRESHOLD.WARNING) return 'warning';
    return 'critical';
  };

  // Sort symbols
  const sortedSymbols = [...symbols].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    
    if (sortConfig.direction === 'asc') {
      return aValue > bValue ? 1 : -1;
    }
    return aValue < bValue ? 1 : -1;
  });

  // Handle sort
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // Get lagging symbols (< HEALTHY threshold)
  const laggingSymbols = symbols.filter((s) => s.status !== 'healthy');

  // Trigger backfill for a single symbol
  const triggerBackfill = async (symbol, fromDate, toDate) => {
    setBackfillInProgress((prev) => ({ ...prev, [symbol]: true }));
    setMessage(null);

    try {
      const res = await fetch(`${API_URL}/api/v1/system/backfill/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          fromDate,
          toDate,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `✅ Backfill started for ${symbol}! Job ID: ${data.data?.jobId || 'N/A'}`,
        });
        // Refresh after a delay
        setTimeout(fetchCoverage, 5000);
      } else {
        throw new Error(data.error || 'Failed to trigger backfill');
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: `❌ Failed to start backfill for ${symbol}: ${e.message}`,
      });
    } finally {
      setBackfillInProgress((prev) => ({ ...prev, [symbol]: false }));
      setIsDialogOpen(false);
    }
  };

  // Trigger bulk backfill for all lagging symbols
  const triggerBulkBackfill = async (fromDate, toDate) => {
    setMessage(null);
    const lagging = laggingSymbols.map((s) => s.symbol);
    
    if (lagging.length === 0) {
      setMessage({ type: 'info', text: 'No lagging symbols to backfill.' });
      return;
    }

    // Mark all as in progress
    const inProgressMap = {};
    lagging.forEach((s) => {
      inProgressMap[s] = true;
    });
    setBackfillInProgress((prev) => ({ ...prev, ...inProgressMap }));

    try {
      // Trigger backfill for ALL symbols (null means all)
      const res = await fetch(`${API_URL}/api/v1/system/backfill/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: null, // All symbols
          fromDate,
          toDate,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: 'success',
          text: `✅ Bulk backfill started for ${lagging.length} lagging symbols! Job ID: ${data.data?.jobId || 'N/A'}`,
        });
        setTimeout(fetchCoverage, 10000);
      } else {
        throw new Error(data.error || 'Failed to trigger bulk backfill');
      }
    } catch (e) {
      setMessage({
        type: 'error',
        text: `❌ Bulk backfill failed: ${e.message}`,
      });
    } finally {
      // Clear all in progress
      setBackfillInProgress({});
    }
  };

  // Open dialog for a specific symbol
  const openBackfillDialog = (symbol) => {
    setSelectedSymbol(symbol);
    setIsDialogOpen(true);
  };

  // Close dialog
  const closeDialog = () => {
    setSelectedSymbol(null);
    setIsDialogOpen(false);
  };

  // Compute summary stats
  const summary = {
    totalSymbols: symbols.length,
    healthyCount: symbols.filter((s) => s.status === 'healthy').length,
    warningCount: symbols.filter((s) => s.status === 'warning').length,
    criticalCount: symbols.filter((s) => s.status === 'critical').length,
    totalCandles: symbols.reduce((sum, s) => sum + (s.total_candles || 0), 0),
  };

  return {
    symbols: sortedSymbols,
    loading,
    error,
    summary,
    laggingSymbols,
    selectedSymbol,
    isDialogOpen,
    backfillInProgress,
    message,
    sortConfig,
    handleSort,
    fetchCoverage,
    triggerBackfill,
    triggerBulkBackfill,
    openBackfillDialog,
    closeDialog,
    setMessage,
  };
}
