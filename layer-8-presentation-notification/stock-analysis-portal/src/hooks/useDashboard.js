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
      const results = await Promise.allSettled([
        axios.get(`${API_URL}/market-view`),
        axios.get(`${API_URL}/signals`),
        axios.get(`${API_URL}/system-status`),
      ]);

      const marketRes =
        results[0].status === 'fulfilled' ? results[0].value : { data: { all_stocks: [] } };
      const signalsRes = results[1].status === 'fulfilled' ? results[1].value : { data: [] };
      const systemRes =
        results[2].status === 'fulfilled' ? results[2].value : { data: { status: 'PARTIAL' } };

      if (results[0].status === 'rejected') console.warn('Market API Failed', results[0].reason);
      if (results[1].status === 'rejected') console.warn('Signals API Failed', results[1].reason);
      if (results[2].status === 'rejected') console.warn('System API Failed', results[2].reason);

      console.log('DEBUG: API_URL', API_URL);
      console.log('DEBUG: marketRes', marketRes);
      console.log('DEBUG: signalsRes', signalsRes.data);
      console.log('DEBUG: systemRes', systemRes.data);

      const stocks = marketRes.data.all_stocks || [];
      console.log('DEBUG: stocks length:', stocks.length);

      // If no stocks, dispatch minimal update to keep system online but don't overwrite if we have old data?
      // Actually, if stocks are empty, it means system has no data.
      if (stocks.length === 0) {
        console.warn('DEBUG: No stocks found, dispatching loading=false');
        // Just update system status and signals, keep loading false so we can show "No Data" UI
        dispatch(setSystemStatus(systemRes.data));
        dispatch(setSignals(signalsRes.data));
        dispatch(setMarketLoading(false));
        return;
      }

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
      if (err.response) {
        console.error('DEBUG: Error Response', err.response.data);
        console.error('DEBUG: Error Status', err.response.status);
      }
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
