// @ts-nocheck
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import AdvanceDeclineBar from '@/components/organisms/AdvanceDeclineBar';
import SectorRotation from '@/components/organisms/SectorRotation';
import HeavyweightTable from '@/components/organisms/HeavyweightTable';
import {
  fetchRegime,
  fetchBreadth,
  selectRegime,
  selectBreadth,
  selectSectors,
  selectRegimeUpdatedAt,
  selectRegimeReachable,
} from '@/store/slices/regimeSlice';
import { useSocket } from '@/hooks/useSocket';

const POLL_MS = 5000;

export default function InternalsPage() {
  const dispatch = useDispatch();
  const regime = useSelector(selectRegime);
  const breadth = useSelector(selectBreadth);
  const sectors = useSelector(selectSectors);
  const lastUpdatedAt = useSelector(selectRegimeUpdatedAt);
  const reachable = useSelector(selectRegimeReachable);

  const { subscribe } = useSocket();
  useEffect(() => { subscribe('market-stream'); }, [subscribe]);

  useEffect(() => {
    const load = () => {
      dispatch(fetchRegime());
      dispatch(fetchBreadth());
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [dispatch]);

  const sectorItems = sectors
    ? Object.entries(sectors).map(([name, data]) => ({
        name,
        status: data?.trend || data?.status || 'FLAT',
      }))
    : null;

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-4 flex-wrap">
        <h1 className="text-[22px] font-extrabold tracking-tight">Market Internals</h1>
        <span className="text-sm text-text-tertiary">Derive the index from its 50 constituents — is this move real or fake?</span>
      </div>
      <div className="grid gap-3.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
        <AdvanceDeclineBar
          advancing={breadth?.advancing ?? null}
          declining={breadth?.declining ?? null}
          aboveVwap={breadth?.aboveVwapPct ?? null}
          aboveEma20={breadth?.aboveEma20Pct ?? null}
          adRatio={breadth?.adRatio ?? null}
          breadth={breadth?.sentiment ?? null}
        />
        <SectorRotation sectors={sectorItems} />
      </div>
      <div className="mt-4">
        <HeavyweightTable stocks={null} />
      </div>
    </AppShell>
  );
}
