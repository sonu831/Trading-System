// @ts-nocheck
import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import { selectPipelineStatus, selectSystemDbRows, selectSwarmStatus, setSwarmStatus, updateSystemStats } from '@/store/slices/systemSlice';
import { selectBackfillManager } from '@/hooks/useBackfillManager';
import { Activity, Database, HardDrive, Layers, Server, Zap, AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';

function formatCount(n) { return n != null ? n.toLocaleString('en-IN') : '—'; }
function formatUptime(sec) { if (!sec) return '—'; const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return `${h}h ${m}m`; }

function StatCard({ icon: Icon, label, value, tone = '', footnote }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className="text-text-tertiary" />}
        <span className="text-[11px] uppercase tracking-wider text-text-tertiary">{label}</span>
      </div>
      <div className={`text-xl font-extrabold tabular-nums ${tone === 'ok' ? 'text-success' : tone === 'warn' ? 'text-warning' : tone === 'err' ? 'text-error' : 'text-text-primary'}`}>
        {value}
      </div>
      {footnote && <div className="text-[11px] text-text-tertiary mt-1">{footnote}</div>}
    </div>
  );
}

function LayerRow({ name, status, lag }) {
  const isUp = status === 'ONLINE' || status === 'UP';
  const isLagging = lag && parseFloat(lag) > 1;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className={`w-2 h-2 rounded-full ${isUp ? (isLagging ? 'bg-warning animate-pulse' : 'bg-success') : 'bg-error'}`} />
        <span className="text-sm">{name}</span>
        <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{isUp ? (isLagging ? `LAG ${lag}` : 'UP') : 'DOWN'}</span>
      </div>
      {isUp && !isLagging && <CheckCircle2 size={14} className="text-success" />}
      {isUp && isLagging && <AlertTriangle size={14} className="text-warning" />}
      {!isUp && <AlertTriangle size={14} className="text-error" />}
    </div>
  );
}

export default function OperatePage() {
  const dispatch = useDispatch();
  const [istTime, setIstTime] = useState('');
  const pipeline = useSelector(selectPipelineStatus);
  const dbRows = useSelector(selectSystemDbRows);
  const swarmStatus = useSelector(selectSwarmStatus);
  const backfillData = pipeline?.layers?.layer1?.backfill;
  const layers = pipeline?.layers || {};

  // Poll system stats + swarm status
  useEffect(() => {
    const poll = async () => {
      try {
        // DB row count
        const statsRes = await fetch('/api/v1/data/stats');
        const statsData = await statsRes.json();
        if (statsData?.data?.candles_1m != null) {
          dispatch(updateSystemStats({ dbRows: statsData.data.candles_1m }));
        }
        // Swarm status
        const swarmRes = await fetch('/api/v1/system/backfill/swarm/status');
        const swarmData = await swarmRes.json();
        if (swarmData?.success || swarmData?.status) {
          dispatch(setSwarmStatus(swarmData.data || swarmData));
        }
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [dispatch]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setIstTime(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' IST');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const layerEntries = Object.entries(layers);
  const upCount = layerEntries.filter(([, l]: any) => l?.status === 'ONLINE' || l?.status === 'UP').length;
  const swarmWorkers = swarmStatus?.totalPartitions || swarmStatus?.workers?.length || 0;

  return (
    <AppShell>
      <div className="flex items-baseline gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Operations Dashboard</h1>
          <span className="text-sm text-text-tertiary">Backfill · Swarm · System health · Runtime</span>
        </div>
        <span className="ml-auto text-xs text-text-tertiary tabular-nums">{istTime}</span>
      </div>

      {/* STATUS BAR — derived from live API data */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <StatCard icon={Layers} label="Services up" value={`${upCount}/${layerEntries.length || 7}`} tone={upCount >= 5 ? 'ok' : 'warn'} footnote="of 7 critical layers" />
        <StatCard icon={Activity} label="Backfill" value={backfillData?.status === 'running' ? 'RUNNING' : swarmStatus?.status === 'RUNNING' ? 'RUNNING' : 'IDLE'} tone={backfillData?.status === 'running' || swarmStatus?.status === 'RUNNING' ? 'ok' : ''} footnote={backfillData?.progress ? `${backfillData.progress}% complete` : 'click to manage'} />
        <StatCard icon={Zap} label="WS ticks/sec" value={pipeline?.layers?.layer1?.metrics?.type === 'Stream' ? 'Active' : '—'} tone={pipeline?.layers?.layer1?.metrics?.type === 'Stream' ? 'ok' : ''} footnote="MStock WebSocket" />
        <StatCard icon={Clock} label="Uptime" value={formatUptime(pipeline?.layers?.layer7?.metrics?.uptime)} footnote="since last restart" />
        <StatCard icon={Database} label="DB rows" value={formatCount(dbRows)} tone={dbRows > 0 ? 'ok' : ''} footnote="candles_1m hypertable" />
        <StatCard icon={HardDrive} label="Redis" value={pipeline?.infra?.redis === 'ONLINE' ? 'Online' : '—'} tone={pipeline?.infra?.redis === 'ONLINE' ? 'ok' : 'warn'} footnote="LTP + candle cache" />
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>

        {/* SYSTEM HEALTH */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2"><Server size={14} className="text-text-tertiary" />System health</h2>
            <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ${upCount >= 5 ? 'badge-ok' : 'badge-err'}`}>
              {upCount >= 5 ? 'HEALTHY' : 'DEGRADED'}
            </span>
          </div>
          {layerEntries.length > 0 ? (
            layerEntries.map(([key, layer]: any) => (
              <LayerRow key={key} name={layer?.name || key} status={layer?.status} lag={layer?.metrics?.lag} />
            ))
          ) : (
            <>
              <LayerRow name="L1 · Ingestion" status="—" />
              <LayerRow name="L2 · Processing" status="—" />
              <LayerRow name="L3 · Storage (TSDB+Redis)" status={pipeline?.infra?.timescaledb === 'ONLINE' ? 'ONLINE' : '—'} />
              <LayerRow name="L4 · Analysis (Go)" status="—" />
              <LayerRow name="L5 · Aggregation" status="—" />
              <LayerRow name="L6 · Signal Engine" status="—" />
              <LayerRow name="L7 · API Gateway" status="ONLINE" />
            </>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <Link href="/system" className="text-xs text-primary hover:underline">View full system visualizer →</Link>
          </div>
        </div>

        {/* BACKFILL */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2"><Database size={14} className="text-text-tertiary" />Backfill</h2>
            <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ${backfillData?.status === 'running' || swarmStatus?.status === 'RUNNING' ? 'badge-ok' : 'badge-neutral'}`}>
              {backfillData?.status === 'running' ? 'RUNNING' : swarmStatus?.status === 'RUNNING' ? 'SWARM RUNNING' : 'IDLE'}
            </span>
          </div>

          {backfillData?.status === 'running' || swarmStatus?.status === 'RUNNING' ? (
            <>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] text-text-tertiary">
                  {swarmStatus?.symbol || 'NIFTY 50'} · 1m candles
                </span>
                <span className="text-xs tabular-nums font-semibold">
                  {swarmStatus?.status === 'RUNNING' ? `${swarmStatus.completedPartitions || 0}/${swarmStatus.totalPartitions || '?'}` : `${backfillData?.progress || 0}%`}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-hover overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700"
                  style={{ width: swarmStatus?.status === 'RUNNING' ? `${((swarmStatus.completedPartitions || 0) / (swarmStatus.totalPartitions || 1)) * 100}%` : `${backfillData?.progress || 0}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-text-tertiary mt-2">
                <span>{swarmStatus?.status === 'RUNNING' ? `Swarm · ${swarmStatus.totalPartitions || 0} partitions` : 'Processing...'}</span>
                <span>{swarmStatus?.startTime ? `since ${new Date(swarmStatus.startTime).toLocaleTimeString()}` : ''}</span>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <Database size={32} className="text-text-tertiary mx-auto mb-2 opacity-30" />
              <p className="text-sm text-text-secondary">No active backfill job</p>
              <p className="text-xs text-text-tertiary mt-1">Historical data for 5-year backtesting</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border">
            <div><div className="text-[10px] uppercase text-text-tertiary">Symbols covered</div><div className="tabular-nums text-lg font-bold">{backfillData?.symbolsCovered != null ? `${backfillData.symbolsCovered} / 50` : '—'}</div></div>
            <div><div className="text-[10px] uppercase text-text-tertiary">Earliest candle</div><div className="tabular-nums text-lg font-bold">{backfillData?.earliestDate || '—'}</div></div>
            <div><div className="text-[10px] uppercase text-text-tertiary">Total records</div><div className="tabular-nums text-lg font-bold">{formatCount(dbRows)}</div></div>
            <div><div className="text-[10px] uppercase text-text-tertiary">Gaps detected</div><div className={`tabular-nums text-lg font-bold ${backfillData?.gaps > 0 ? 'text-warning' : ''}`}>{backfillData?.gaps != null ? backfillData.gaps : '—'}</div></div>
          </div>

          <div className="mt-4 flex gap-2">
            <Link href="/backfill" className="btn-primary text-xs flex-1 justify-center">Manage backfill</Link>
            <Link href="/swarm" className="text-xs px-3 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition">Swarm →</Link>
          </div>
        </div>

        {/* SWARM WORKERS */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold flex items-center gap-2"><Zap size={14} className="text-text-tertiary" />Swarm workers</h2>
            <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ${swarmWorkers > 0 ? 'badge-ok' : 'badge-neutral'}`}>
              {swarmWorkers > 0 ? `${swarmWorkers} ACTIVE` : 'IDLE'}
            </span>
          </div>

          {swarmWorkers > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-surface-hover rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold tabular-nums">{swarmStatus?.queueDepth != null ? swarmStatus.queueDepth : '—'}</div>
                  <div className="text-[10px] uppercase text-text-tertiary">Queue depth</div>
                </div>
                <div className="bg-surface-hover rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold tabular-nums text-success">{swarmStatus?.throughput != null ? `${swarmStatus.throughput}/s` : '—'}</div>
                  <div className="text-[10px] uppercase text-text-tertiary">Throughput</div>
                </div>
                <div className="bg-surface-hover rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold tabular-nums">{swarmStatus?.errors != null ? swarmStatus.errors : '—'}</div>
                  <div className="text-[10px] uppercase text-text-tertiary">Errors</div>
                </div>
                <div className="bg-surface-hover rounded-lg p-3 text-center">
                  <div className="text-2xl font-extrabold tabular-nums">{swarmStatus?.avgLatencyMs != null ? `${swarmStatus.avgLatencyMs}ms` : '—'}</div>
                  <div className="text-[10px] uppercase text-text-tertiary">Avg latency</div>
                </div>
              </div>
              <div className="space-y-1.5">
                {(swarmStatus?.partitions || []).slice(0, 8).map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between py-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'COMPLETED' ? 'bg-success' : p.status === 'RUNNING' ? 'bg-primary animate-pulse' : p.status === 'FAILED' ? 'bg-error' : 'bg-border'}`} />
                      <span className="tabular-nums text-text-secondary">{p.id || `worker-${String(i + 1).padStart(2, '0')}`}</span>
                      <span className="text-[10px] text-text-tertiary">{p.range || ''}</span>
                    </div>
                    <span className="badge text-[9px] px-1.5 py-0.5 rounded-full border badge-neutral">{p.status || 'pending'}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <Zap size={28} className="text-text-tertiary mx-auto mb-2 opacity-30" />
              <p className="text-sm text-text-secondary">No active workers</p>
              <p className="text-xs text-text-tertiary mt-1">Swarm workers spin up when backfill is triggered</p>
            </div>
          )}

          <Link href="/swarm" className="block text-xs text-primary hover:underline mt-3 pt-3 border-t border-border">Open full swarm monitor →</Link>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Link href="/backfill" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">📥</span><div className="text-sm font-semibold mt-1">Trigger backfill</div><div className="text-[10px] text-text-tertiary">Historical data</div>
        </Link>
        <Link href="/system" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">🖥</span><div className="text-sm font-semibold mt-1">System visualizer</div><div className="text-[10px] text-text-tertiary">Pipeline flow</div>
        </Link>
        <Link href="/swarm" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">🐝</span><div className="text-sm font-semibold mt-1">Swarm monitor</div><div className="text-[10px] text-text-tertiary">Worker dashboard</div>
        </Link>
        <Link href="/alerts" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">🔔</span><div className="text-sm font-semibold mt-1">System alerts</div><div className="text-[10px] text-text-tertiary">Notifications</div>
        </Link>
      </div>
    </AppShell>
  );
}
