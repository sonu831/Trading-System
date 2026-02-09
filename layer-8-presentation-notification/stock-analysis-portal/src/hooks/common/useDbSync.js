import { useState, useEffect, useRef } from 'react';

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_BACKFILL_POLL_INTERVAL) || 30000;

/**
 * useDbSync Hook
 * 
 * Tracks the live row count of the primary data table (candles_1m) 
 * and determines if ingestion is active based on count velocity.
 * 
 * @returns {Object} { count, isSyncing, isLoading, error }
 */
export const useDbSync = () => {
  const [count, setCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Track previous count to determine velocity
  const prevCountRef = useRef(0);

  useEffect(() => {
    let intervalId;

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/data/stats');
        if (!res.ok) throw new Error('Failed to fetch stats');
        
        const data = await res.json();
        const currentCount = data.data?.candles_1m || 0;
        
        setCount(currentCount);

        // Determine Sync Status
        if (currentCount > prevCountRef.current) {
           setIsSyncing(true);
        } else if (currentCount === prevCountRef.current && currentCount > 0) {
           setIsSyncing(false);
        }
        
        prevCountRef.current = currentCount;
        setIsLoading(false);
      } catch (err) {
        console.warn('[useDbSync] Poll failed:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    fetchStats(); // Initial fetch
    intervalId = setInterval(fetchStats, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  return { count, isSyncing, isLoading, error };
};
