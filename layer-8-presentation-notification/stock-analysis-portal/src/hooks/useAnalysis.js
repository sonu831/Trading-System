import { useState, useEffect, useCallback } from 'react';

const API_URL = ''; // Uses proxy

const VALID_INTERVALS = ['1m', '5m', '10m', '15m', '30m', '1h', '4h', '1d', '1w'];

/**
 * Custom hook for stock analysis page
 * Handles candle data fetching, interval changes, and indicator data
 */
export default function useAnalysis(symbolProp) {
  const [symbol, setSymbol] = useState(symbolProp?.toUpperCase() || '');
  const [interval, setInterval] = useState('15m');
  const [candleData, setCandleData] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState(null);
  const [multiTF, setMultiTF] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch candles with indicators
  const fetchCandles = useCallback(async (sym, intv) => {
    if (!sym) return;

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_URL}/api/market/candles?symbol=${encodeURIComponent(sym)}&interval=${intv}&limit=500`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch candles');
      }

      setCandleData(data.data?.candles || []);
      setIndicators(data.data?.indicators || null);
      setSummary(data.data?.summary || null);
    } catch (e) {
      console.error('Failed to fetch candles:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stock overview
  const fetchOverview = useCallback(async (sym) => {
    if (!sym) return;

    try {
      const res = await fetch(`${API_URL}/api/market/overview/${encodeURIComponent(sym)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setOverview(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch overview:', e);
    }
  }, []);

  // Fetch multi-timeframe summary
  const fetchMultiTF = useCallback(async (sym) => {
    if (!sym) return;

    try {
      const res = await fetch(`${API_URL}/api/market/multi-tf/${encodeURIComponent(sym)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setMultiTF(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch multi-TF:', e);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (symbolProp) {
      const sym = symbolProp.toUpperCase();
      setSymbol(sym);
      fetchCandles(sym, interval);
      fetchOverview(sym);
      fetchMultiTF(sym);
    }
  }, [symbolProp, fetchCandles, fetchOverview, fetchMultiTF, interval]);

  // Change interval
  const changeInterval = useCallback(
    (newInterval) => {
      if (VALID_INTERVALS.includes(newInterval) && newInterval !== interval) {
        setInterval(newInterval);
        fetchCandles(symbol, newInterval);
      }
    },
    [symbol, interval, fetchCandles]
  );

  // Refresh data
  const refresh = useCallback(() => {
    fetchCandles(symbol, interval);
    fetchOverview(symbol);
    fetchMultiTF(symbol);
  }, [symbol, interval, fetchCandles, fetchOverview, fetchMultiTF]);

  return {
    symbol,
    interval,
    candleData,
    indicators,
    summary,
    overview,
    multiTF,
    loading,
    error,
    changeInterval,
    refresh,
    VALID_INTERVALS,
  };
}
