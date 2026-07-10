import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import SafetyBar from '@/components/organisms/SafetyBar';
import PriceChart from '@/components/organisms/PriceChart';
import CockpitTemplate from '@/components/templates/CockpitTemplate';
import RegimeCard from '@/components/regime/RegimeCard';
import StatTile from '@/components/trading/StatTile';
import PositionsTable from '@/components/trading/PositionsTable';
import DailyRiskCard from '@/components/trading/DailyRiskCard';
import StaleBadge from '@/components/trading/StaleBadge';

function useIndexQuote(underlying) {
  const [quote, setQuote] = useState(null);
  useEffect(() => {
    let active = true;
    const fetchQuote = () => {
      fetch(`/api/v1/market/index/${underlying}/quote`)
        .then(r => r.json()).then(d => { if (active && d.success) setQuote(d.data); });
    };
    fetchQuote();
    const t = setInterval(fetchQuote, 3000);
    return () => { active = false; clearInterval(t); };
  }, [underlying]);
  return quote;
}

function useCandles(underlying, tf = '1m', limit = 200) {
  const [candles, setCandles] = useState([]);
  useEffect(() => {
    let active = true;
    const fetchData = () => {
      fetch(`/api/v1/market/index/${underlying}/candles?tf=${tf}&limit=${limit}`)
        .then(r => r.json()).then(d => { if (active && d.success) setCandles(d.data.candles || []); });
    };
    fetchData();
    const t = setInterval(fetchData, 10000);
    return () => { active = false; clearInterval(t); };
  }, [underlying, tf, limit]);
  return candles;
}

export default function ScalpCockpit() {
  const router = useRouter();
  const underlying = router.query.underlying || 'NIFTY';
  const [timeframe, setTimeframe] = useState('1m');

  const regime = useSelector((s) => s.regime?.latest || {});
  const execState = useSelector((s) => s.execution || {});
  const positions = useSelector((s) => s.execution?.positions || []);

  const quote = useIndexQuote(underlying);
  const candles = useCandles(underlying, timeframe);
  const dayPnl = execState?.dailyPnl || 0;

  return (
    <CockpitTemplate
      safetyBar={<SafetyBar underlying={underlying} spot={quote?.ltp} regimeUpdatedAt={regime?.timestamp} />}
      chart={
        <div>
          <div className="flex gap-1 mb-2">
            {['1m', '5m', '15m', '1h'].map(tf => (
              <button key={tf} onClick={() => setTimeframe(tf)}
                className={`px-2 py-0.5 text-xs rounded ${timeframe === tf ? 'bg-primary text-white' : 'bg-surface border border-border text-text-tertiary hover:text-text-secondary'}`}>
                {tf}
              </button>
            ))}
          </div>
          <PriceChart candles={candles} timeframe={timeframe} />
        </div>
      }
      hero={
        <div className="space-y-4">
          <StatTile label="Day P&L" value={dayPnl} format="currency" size="lg" />
          <DailyRiskCard />
        </div>
      }
      context={
        <div className="space-y-4">
          {Object.keys(regime).length > 0 ? (
            <RegimeCard regime={regime} />
          ) : (
            <div className="bg-surface border border-border rounded-xl p-4 text-text-tertiary text-sm text-center">
              <StaleBadge updatedAt={regime?.timestamp} label="Regime" />
              <div className="mt-2">Waiting for regime data...</div>
            </div>
          )}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-2">Market Breadth</h3>
            <div className="flex gap-4 text-xs text-text-tertiary">
              <span>{'A/D: —'}</span>
              <span>{'>EMA20: —%'}</span>
              <span>VIX: —</span>
            </div>
          </div>
        </div>
      }
      details={
        <div className="space-y-4">
          <PositionsTable positions={positions} mode={execState?.mode} />
          <div className="text-xs text-text-tertiary text-center">Signals · Orders · Latency (Phase 5)</div>
        </div>
      }
    />
  );
}
