import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  setMarketData,
  setLoading as setMarketLoading,
  selectMarketView,
  selectMarketLoading,
} from '@/store/slices/marketSlice';
import { setSignals, selectSignals } from '@/store/slices/signalsSlice';
import {
  setSystemStatus,
  setViewMode,
  selectSystemStatus,
  selectViewMode,
} from '@/store/slices/systemSlice';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const useDashboard = () => {
  const dispatch = useDispatch();

  // Selectors
  const marketView = useSelector(selectMarketView);
  const signals = useSelector(selectSignals);
  const systemStatus = useSelector(selectSystemStatus);
  const viewMode = useSelector(selectViewMode);
  const loading = useSelector(selectMarketLoading);

  const fetchData = useCallback(async () => {
    try {
      const [marketRes, signalsRes, systemRes] = await Promise.all([
        axios.get(`${API_URL}/market-view`),
        axios.get(`${API_URL}/signals`),
        axios.get(`${API_URL}/system-status`),
      ]);

      const stocks = marketRes.data.all_stocks || [];

      // Calculate Advance/Decline
      const advances = stocks.filter((s) => s.change_pct > 0).length;
      const declines = stocks.filter((s) => s.change_pct < 0).length;

      // Calculate Sentiment (Simple logic for now)
      const ratio = advances / (advances + declines || 1);
      let sentiment = 'Neutral';
      if (ratio > 0.6) sentiment = 'Bullish';
      if (ratio < 0.4) sentiment = 'Bearish';

      dispatch(
        setMarketData({
          ...marketRes.data,
          marketSentiment: sentiment,
          advanceDecline: { advances, declines },
          timestamp: new Date().toISOString(),
        })
      );

      dispatch(setSignals(signalsRes.data));
      dispatch(setSystemStatus(systemRes.data)); // Dispatch full object
      dispatch(setMarketLoading(false));
    } catch (err) {
      console.error('Failed to fetch dashboard data', err);
      // Optional: dispatch(setSystemStatus('OFFLINE'));
    }
  }, [dispatch]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // 3s polling
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSetViewMode = (mode) => {
    dispatch(setViewMode(mode));
  };

  return {
    marketView,
    signals,
    systemStatus,
    loading,
    viewMode,
    setViewMode: handleSetViewMode,
    refresh: fetchData,
  };
};
