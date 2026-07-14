import { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '@/store/slices/systemSlice';

const API_URL = ''; // Uses proxy

const CANDLE_THRESHOLD = {
  HEALTHY: 50000, // > 50k candles = healthy
  WARNING: 20000, // 20k-50k = warning
  // < 20k = critical
};

async function checkProviderReady() {
  try {
    const res = await fetch(`${API_URL}/api/v1/providers`);
    const data = await res.json();
    if (!data.success || !data.data) return 'unreachable';
    const providers = data.data || [];
    const mstock = providers.find((p) => p.provider === 'mstock');
    if (!mstock) return 'no-provider';
    if (mstock.status === 'CONNECTED') return 'ready';
    if (mstock.status === 'ERROR' || mstock.status === 'DISABLED') return `error:${mstock.status}`;
    return 'not-ready';
  } catch (e) {
    return 'unreachable';
  }
}

export default function useBackfillManager() {
  const dispatch = useDispatch();
  const [symbols, setSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [backfillInProgress, setBackfillInProgress] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'total_candles', direction: 'asc' });
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);

  const toast = (type, text, title) => dispatch(addToast({ type, text, title }));

  const fetchCoverage = useCallback(async () => {
    try {
      setLoading(true);
      const [availRes, symRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/data/availability`).then(r => r.json()).catch(() => ({ data: null })),
        fetch(`${API_URL}/api/v1/data/symbols`).then(r => r.json()).catch(() => ({ data: { symbols: [] } })),
      ]);

      const configuredSymbols = symRes.data?.symbols || [];
      const configuredSet = new Set(configuredSymbols.map((s) => s.symbol));
      const coverageMap = {};
      if (availRes.data?.symbols) {
        for (const row of availRes.data.symbols) {
          coverageMap[row.symbol] = row;
        }
      }

      const symbolsData = configuredSymbols.map((cfg) => {
        const covered = coverageMap[cfg.symbol];
        return {
          symbol: cfg.symbol,
          exchange: cfg.exchange || 'NSE',
          sector: cfg.sector || null,
          total_candles: covered?.total_candles || covered?.total_records || 0,
          first_date: covered?.first_date || covered?.earliest || null,
          last_date: covered?.last_date || covered?.latest || null,
          status: covered ? getSymbolStatus(covered.total_candles || covered.total_records || 0) : 'unpopulated',
        };
      });

      if (availRes.data?.symbols) {
        for (const row of availRes.data.symbols) {
          if (!configuredSet.has(row.symbol)) {
            symbolsData.push({
              symbol: row.symbol,
              exchange: 'NSE',
              sector: null,
              total_candles: row.total_candles || row.total_records || 0,
              first_date: row.first_date || row.earliest || null,
              last_date: row.last_date || row.latest || null,
              status: getSymbolStatus(row.total_candles || row.total_records || 0),
            });
          }
        }
      }

      setSymbols(symbolsData);
      setError(null);
    } catch (e) {
      console.error('Failed to fetch coverage:', e);
      setError(e.message);
      toast('error', e.message, 'Coverage fetch failed');
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const getSymbolStatus = (candleCount) => {
    if (candleCount >= CANDLE_THRESHOLD.HEALTHY) return 'healthy';
    if (candleCount >= CANDLE_THRESHOLD.WARNING) return 'warning';
    return 'critical';
  };

  const sortedSymbols = [...symbols].sort((a, b) => {
    const aValue = a[sortConfig.key];
    const bValue = b[sortConfig.key];
    if (sortConfig.direction === 'asc') return aValue > bValue ? 1 : -1;
    return aValue < bValue ? 1 : -1;
  });

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const laggingSymbols = symbols.filter((s) => s.status !== 'healthy');

  useEffect(() => {
    if (!activeJobId) return;
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/backfill/${activeJobId}`);
        const data = await res.json();
        if (data.success || data.data) {
          setJobStatus(data.data || data);
          if (data.data?.status === 'COMPLETED' || data.data?.status === 'FAILED') {
            setActiveJobId(null);
            const processed = data.data?.processed || 0;
            const wasFailed = data.data?.status === 'FAILED';
            const zeroResult = processed === 0 && data.data?.status === 'COMPLETED';
            const authError = (data.data?.errors || []).some(
              (e) => typeof e === 'string' && (e.includes('401') || e.includes('auth') || e.includes('token') || e.includes('session'))
            );

            if (wasFailed || (zeroResult && authError)) {
              toast('error', authError ? 'mStock session not ready — authenticate via Broker Detail page first. Go to /brokers to check provider status.' : (data.data?.errors?.[0] || '0 records processed'), 'Backfill failed');
            } else if (zeroResult) {
              toast('warning', '0 candles returned — provider may need re-authentication. Check provider status in /brokers.', 'Backfill warning');
            } else {
              toast('success', `${processed.toLocaleString()} records`, 'Backfill complete');
            }
            setBackfillInProgress({});
            fetchCoverage();
          }
        }
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [activeJobId]);

  const triggerBackfill = async (symbol, fromDate, toDate) => {
    setBackfillInProgress((prev) => ({ ...prev, [symbol]: true }));

    const providerStatus = await checkProviderReady();
    if (providerStatus !== 'ready') {
      const msgs = {
        'no-provider': 'No mStock provider found — add one via /brokers',
        'not-ready': 'mStock session not ready — enter TOTP via Broker Detail page first',
        'unreachable': 'Cannot reach provider API — check broker service status',
      };
      toast('error', msgs[providerStatus] || providerStatus, 'Cannot start backfill');
      setBackfillInProgress((prev) => ({ ...prev, [symbol]: false }));
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/v1/system/backfill/trigger`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, fromDate, toDate }),
      });
      const data = await res.json();
      if (res.ok) {
        const jobId = data.data?.jobId;
        if (jobId) setActiveJobId(jobId);
        toast('success', `Backfill started for ${symbol} — monitoring progress`, 'Backfill triggered');
      } else {
        toast('error', data.error || 'Failed to trigger backfill', 'Backfill error');
      }
    } catch (e) {
      toast('error', `${symbol}: ${e.message}`, 'Backfill failed');
    } finally {
      setBackfillInProgress((prev) => ({ ...prev, [symbol]: false }));
      setIsDialogOpen(false);
    }
  };

  const triggerBulkBackfill = async (fromDate, toDate) => {
    const providerStatus = await checkProviderReady();
    if (providerStatus !== 'ready') {
      const msgs = {
        'no-provider': 'No mStock provider found — add one via /brokers',
        'not-ready': 'mStock session not ready — enter TOTP via Broker Detail page first',
        'unreachable': 'Cannot reach provider API — check broker service status',
      };
      toast('error', msgs[providerStatus] || providerStatus, 'Cannot start bulk backfill');
      return;
    }

    const lagging = laggingSymbols.map((s) => s.symbol);
    if (lagging.length === 0) {
      toast('info', 'All symbols are healthy — nothing to backfill.', 'Backfill');
      return;
    }

    const inProgressMap = {};
    lagging.forEach((s) => { inProgressMap[s] = true; });
    setBackfillInProgress((prev) => ({ ...prev, ...inProgressMap }));

    try {
      const res = await fetch(`${API_URL}/api/v1/system/backfill/trigger`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: null, fromDate, toDate }),
      });
      const data = await res.json();
      if (res.ok) {
        const jobId = data.data?.jobId;
        if (jobId) setActiveJobId(jobId);
        toast('success', `Bulk backfill started for ${lagging.length} symbols — monitoring`, 'Backfill triggered');
      } else {
        toast('error', data.error || 'Failed to trigger bulk backfill', 'Bulk backfill error');
      }
    } catch (e) {
      toast('error', e.message, 'Bulk backfill failed');
    } finally {
      setBackfillInProgress({});
    }
  };

  const openBackfillDialog = (symbol) => {
    setSelectedSymbol(symbol);
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setSelectedSymbol(null);
    setIsDialogOpen(false);
  };

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
    sortConfig,
    activeJobId,
    jobStatus,
    handleSort,
    fetchCoverage,
    triggerBackfill,
    triggerBulkBackfill,
    openBackfillDialog,
    closeDialog,
  };
}
