import { useEffect, useState } from 'react';
import { secondsSince } from '@/utils/format';

/**
 * Dashboard rule U4: stale data must announce itself.
 *
 * A trading screen that silently shows a two-minute-old price is worse than one
 * that shows nothing — the operator will act on it. This ticks every second and
 * classifies freshness so panels can visibly degrade.
 *
 * @param {string|null} timestamp ISO timestamp of the last update
 * @param {{warnAfter?: number, staleAfter?: number}} thresholds (seconds)
 * @returns {{seconds: number|null, level: 'unknown'|'fresh'|'warn'|'stale'}}
 */
export function useStaleness(timestamp, { warnAfter = 30, staleAfter = 120 } = {}) {
  const [seconds, setSeconds] = useState(() => secondsSince(timestamp));

  useEffect(() => {
    setSeconds(secondsSince(timestamp));
    const id = setInterval(() => setSeconds(secondsSince(timestamp)), 1000);
    return () => clearInterval(id);
  }, [timestamp]);

  let level = 'unknown';
  if (seconds !== null) {
    if (seconds >= staleAfter) level = 'stale';
    else if (seconds >= warnAfter) level = 'warn';
    else level = 'fresh';
  }

  return { seconds, level };
}

export default useStaleness;
