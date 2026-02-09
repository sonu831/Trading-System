import { useState, useRef, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { selectPipelineStatus } from '@/store/slices/systemSlice';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const COMPLETION_TIMEOUT = Number(process.env.NEXT_PUBLIC_BACKFILL_COMPLETION_TIMEOUT) || 60000;
const MAX_DAYS = Number(process.env.NEXT_PUBLIC_BACKFILL_MAX_DAYS) || 30;

export const useBackfillLogic = () => {
  const dispatch = useDispatch();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [symbol, setSymbol] = useState('');
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [coverage, setCoverage] = useState([]);
  const [loadingCoverage, setLoadingCoverage] = useState(true);
  const [jobStatus, setJobStatus] = useState(null);

  // Completion Logic Refs
  const lastCountRef = useRef(0);
  const lastChangeTimeRef = useRef(Date.now());
  const pollingRef = useRef(null);

  const pipelineStatus = useSelector(selectPipelineStatus);
  const backfillStatus = pipelineStatus?.layers?.layer1?.backfill;

  // Initial Setup
  useEffect(() => {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    setToDate(today.toISOString().split('T')[0]);
    setFromDate(weekAgo.toISOString().split('T')[0]);

    fetchCoverage();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Backfill Completion Detection
  useEffect(() => {
    if (!backfillStatus || backfillStatus.status !== 'running') {
      lastCountRef.current = 0;
      lastChangeTimeRef.current = Date.now();
      return;
    }

    const currentCount = backfillStatus.progress || 0;
    const now = Date.now();

    if (currentCount > lastCountRef.current) {
      lastCountRef.current = currentCount;
      lastChangeTimeRef.current = now;
    } else if (currentCount === lastCountRef.current && currentCount > 0) {
      const timeSinceLastChange = now - lastChangeTimeRef.current;
      if (timeSinceLastChange > COMPLETION_TIMEOUT) {
        setMessage({ type: 'success', text: 'Backfill appears complete (no new data for 1 min).' });
      }
    }
  }, [backfillStatus]);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/data/availability`);
      const data = await res.json();
      setCoverage(data.data?.symbols || []);
      setLoadingCoverage(false);
    } catch (e) {
      console.error('Failed to fetch coverage', e);
    }
  }, []);

  const validateDateRange = () => {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to - from);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > MAX_DAYS) {
      setMessage({ type: 'error', text: `Date range cannot exceed ${MAX_DAYS} days` });
      return false;
    }
    if (from > to) {
      setMessage({ type: 'error', text: 'From date must be before To date' });
      return false;
    }
    return true;
  };

  const triggerBackfill = async (e) => {
    e.preventDefault();
    if (!validateDateRange()) return;

    setLoading(true);
    setMessage(null);
    setJobStatus(null);
    
    lastCountRef.current = 0;
    lastChangeTimeRef.current = Date.now();

    try {
      const res = await fetch(`${API_URL}/api/v1/system/backfill/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromDate,
          toDate,
          symbol: symbol || null,
          force,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setJobStatus({
          jobId: data.data?.jobId,
          from: fromDate,
          to: toDate,
          symbol: symbol || 'ALL (Nifty 50)',
          status: 'STARTED',
          timestamp: new Date().toISOString(),
        });
        setMessage({
          type: 'success',
          text: `✅ Backfill started! Job ID: ${data.data?.jobId}. Check Telegram for updates.`,
        });
        setTimeout(fetchCoverage, 5000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to start backfill' });
      }
    } catch (e) {
      setMessage({ type: 'error', text: 'Network error. Is the API running?' });
    } finally {
      setLoading(false);
    }
  };

  return {
    // State
    fromDate, setFromDate,
    toDate, setToDate,
    symbol, setSymbol,
    force, setForce,
    loading,
    message,
    coverage,
    loadingCoverage,
    jobStatus,
    backfillStatus,
    
    // Actions
    triggerBackfill,
    fetchCoverage,
    
    // Constants
    MAX_DAYS
  };
};
