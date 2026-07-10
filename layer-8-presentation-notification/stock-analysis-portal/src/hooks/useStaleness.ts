import { useSelector } from 'react-redux';
import { selectStaleness } from '@/store/slices/cockpitSlice';

const STALE_AMBER_MS = 30000;   // 30s → amber
const STALE_RED_MS = 120000;    // 2min → red

export function useStaleness(stream) {
  const staleness = useSelector(selectStaleness);
  const lastUpdated = staleness[stream];
  if (!lastUpdated) return { status: 'loading', label: 'Waiting' };

  const age = Date.now() - lastUpdated;
  if (age > STALE_RED_MS) return { status: 'error', label: 'Stale', age };
  if (age > STALE_AMBER_MS) return { status: 'warning', label: 'Delayed', age };
  return { status: 'fresh', label: 'Live', age };
}

export default useStaleness;
