import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = ''; // Uses proxy

const VALID_INTERVALS = ['1m', '5m', '10m', '15m', '30m', '1h', '4h', '1d', '1w'];

/**
 * Custom hook for stock analysis page
 * Enhanced with full analysis, AI predictions, backtesting, and options data
 */
export default function useAnalysis(symbolProp) {
  // Core state
  const [symbol, setSymbol] = useState(symbolProp?.toUpperCase() || '');
  const [interval, setInterval] = useState('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Candle and indicator data
  const [candleData, setCandleData] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [summary, setSummary] = useState(null);
  const [patterns, setPatterns] = useState([]);

  // Overview and multi-timeframe
  const [overview, setOverview] = useState(null);
  const [multiTF, setMultiTF] = useState(null); // Legacy
  const [enhancedMultiTF, setEnhancedMultiTF] = useState(null); // New enhanced with verdicts

  // Options data
  const [optionsData, setOptionsData] = useState(null);

  // AI prediction state
  const [aiPrediction, setAiPrediction] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Backtest state
  const [backtestResults, setBacktestResults] = useState(null);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestError, setBacktestError] = useState(null);

  // Abort controller for cancelling requests
  const abortControllerRef = useRef(null);

  /**
   * Fetch full analysis - combined endpoint for maximum performance
   * Returns candles, indicators, patterns, multi-TF verdicts, and options data
   */
  const fetchFullAnalysis = useCallback(async (sym, intv) => {
    if (!sym) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        `${API_URL}/api/market/analysis/${encodeURIComponent(sym)}?interval=${intv}&limit=500`,
        { signal: abortControllerRef.current.signal }
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch analysis');
      }

      const result = data.data;

      // Update all state from combined response
      setCandleData(result.candles || []);
      setIndicators(result.indicators || null);
      setSummary(result.summary || null);
      setPatterns(result.patterns || []);
      setOverview(result.overview || null);
      setEnhancedMultiTF(result.multiTimeframe || null);
      setOptionsData(result.options || null);

      // Also set legacy multiTF for backward compatibility
      if (result.multiTimeframe?.timeframes) {
        setMultiTF(result.multiTimeframe.timeframes);
      }
    } catch (e) {
      if (e.name === 'AbortError') return; // Ignore aborted requests
      console.error('Failed to fetch full analysis:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Legacy: Fetch candles with indicators (for backward compatibility)
   */
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

  /**
   * Fetch stock overview
   */
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

  /**
   * Fetch multi-timeframe summary (legacy)
   */
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

  /**
   * Fetch enhanced multi-timeframe with verdicts
   */
  const fetchEnhancedMultiTF = useCallback(async (sym) => {
    if (!sym) return;

    try {
      const res = await fetch(`${API_URL}/api/market/enhanced-multi-tf/${encodeURIComponent(sym)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setEnhancedMultiTF(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch enhanced multi-TF:', e);
    }
  }, []);

  /**
   * Fetch AI prediction from Layer 9
   */
  const fetchAIPrediction = useCallback(async (sym) => {
    if (!sym) return;

    try {
      setAiLoading(true);
      setAiError(null);

      const res = await fetch(`${API_URL}/api/market/ai-predict/${encodeURIComponent(sym)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch AI prediction');
      }

      setAiPrediction(data.data);
    } catch (e) {
      console.error('Failed to fetch AI prediction:', e);
      setAiError(e.message);
      setAiPrediction(null);
    } finally {
      setAiLoading(false);
    }
  }, []);

  /**
   * Fetch options analysis (PCR, Max Pain)
   */
  const fetchOptionsAnalysis = useCallback(async (sym) => {
    if (!sym) return;

    try {
      const res = await fetch(`${API_URL}/api/market/options/${encodeURIComponent(sym)}`);
      const data = await res.json();

      if (res.ok && data.success) {
        setOptionsData(data.data);
      }
    } catch (e) {
      console.error('Failed to fetch options:', e);
    }
  }, []);

  /**
   * Run historical backtest
   * @param {string} sym - Stock symbol
   * @param {string} indicator - Indicator to test (rsi, macd_hist, stochastic_k, bb_position)
   * @param {string} operator - Comparison operator (lt, gt, lte, gte)
   * @param {number} threshold - Threshold value
   */
  const fetchBacktest = useCallback(async (sym, indicator, operator, threshold) => {
    if (!sym || !indicator || !operator || threshold === undefined) {
      setBacktestError('Missing required parameters');
      return;
    }

    try {
      setBacktestLoading(true);
      setBacktestError(null);

      const params = new URLSearchParams({
        indicator,
        operator,
        threshold: String(threshold),
      });

      const res = await fetch(
        `${API_URL}/api/market/backtest/${encodeURIComponent(sym)}?${params}`
      );
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to run backtest');
      }

      setBacktestResults(data.data);
    } catch (e) {
      console.error('Failed to run backtest:', e);
      setBacktestError(e.message);
      setBacktestResults(null);
    } finally {
      setBacktestLoading(false);
    }
  }, []);

  /**
   * Clear backtest results
   */
  const clearBacktest = useCallback(() => {
    setBacktestResults(null);
    setBacktestError(null);
  }, []);

  // Initial load - use combined endpoint for performance
  useEffect(() => {
    if (symbolProp) {
      const sym = symbolProp.toUpperCase();
      setSymbol(sym);
      fetchFullAnalysis(sym, interval);
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [symbolProp, fetchFullAnalysis, interval]);

  /**
   * Change interval - refetches data
   */
  const changeInterval = useCallback(
    (newInterval) => {
      if (VALID_INTERVALS.includes(newInterval) && newInterval !== interval) {
        setInterval(newInterval);
        fetchFullAnalysis(symbol, newInterval);
      }
    },
    [symbol, interval, fetchFullAnalysis]
  );

  /**
   * Refresh all data
   */
  const refresh = useCallback(() => {
    fetchFullAnalysis(symbol, interval);
  }, [symbol, interval, fetchFullAnalysis]);

  /**
   * Full refresh including AI prediction
   */
  const refreshAll = useCallback(() => {
    fetchFullAnalysis(symbol, interval);
    fetchAIPrediction(symbol);
  }, [symbol, interval, fetchFullAnalysis, fetchAIPrediction]);

  return {
    // Core
    symbol,
    interval,
    loading,
    error,

    // Candle data
    candleData,
    indicators,
    summary,
    patterns,

    // Overview and multi-TF
    overview,
    multiTF,
    enhancedMultiTF,

    // Options
    optionsData,

    // AI Prediction
    aiPrediction,
    aiLoading,
    aiError,
    fetchAIPrediction,

    // Backtest
    backtestResults,
    backtestLoading,
    backtestError,
    fetchBacktest,
    clearBacktest,

    // Actions
    changeInterval,
    refresh,
    refreshAll,
    fetchOptionsAnalysis,
    fetchEnhancedMultiTF,

    // Constants
    VALID_INTERVALS,
  };
}
