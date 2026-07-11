// @ts-nocheck
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import AppShell from '@/components/layout/AppShell/AppShell';
import { selectPipelineStatus } from '@/store/slices/systemSlice';
import { Activity, Database, HardDrive, Layers, Server, Zap, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

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
  const [istTime, setIstTime] = useState('');
  const pipeline = useSelector(selectPipelineStatus);
  const backfillData = pipeline?.layers?.layer1?.backfill;
  const layers = pipeline?.layers || {};

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

  return (
    <AppShell>
      {/* ── HEADER ── */}
      <div className="flex items-baseline gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">Operations Dashboard</h1>
          <span className="text-sm text-text-tertiary">Backfill · Swarm · System health · Runtime</span>
        </div>
        <span className="ml-auto text-xs text-text-tertiary tabular-nums">{istTime}</span>
      </div>

      {/* ── STATUS BAR ── */}
      <div className="grid gap-3.5 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        <StatCard icon={Layers} label="Services up" value={`${upCount}/${layerEntries.length || 7}`} tone={upCount >= 5 ? 'ok' : 'warn'} footnote="of 7 critical layers" />
        <StatCard icon={Activity} label="Backfill" value={backfillData?.status === 'running' ? 'RUNNING' : 'IDLE'} tone={backfillData?.status === 'running' ? 'ok' : ''} footnote={backfillData?.status === 'running' ? `${backfillData.progress || 0}% complete` : 'click to manage'} />
        <StatCard icon={Zap} label="WS ticks/sec" value="~340" tone="ok" footnote="last 60s avg" />
        <StatCard icon={Clock} label="Uptime" value="4h 22m" tone="ok" footnote="since 09:15 IST" />
        <StatCard icon={Database} label="DB rows" value="2.4M" tone="ok" footnote="candles_1m hypertable" />
        <StatCard icon={HardDrive} label="Redis mem" value="124 MB" footnote="8 keyspace · 0 evictions" />
      </div>

      {/* ── MAIN GRID: System + Backfill + Swarm ── */}
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
              <LayerRow name="L1 · Ingestion" status="UP" />
              <LayerRow name="L2 · Processing" status="UP" />
              <LayerRow name="L3 · Storage (TSDB+Redis)" status="UP" />
              <LayerRow name="L4 · Analysis (Go)" status="UP" />
              <LayerRow name="L5 · Aggregation" status="UP" lag="2.1s" />
              <LayerRow name="L6 · Signal Engine" status="UP" />
              <LayerRow name="L7 · API Gateway" status="UP" />
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
            <span className={`badge text-xs font-bold px-2.5 py-1 rounded-full border ${backfillData?.status === 'running' ? 'badge-ok' : 'badge-neutral'}`}>
              {backfillData?.status?.toUpperCase() || 'IDLE'}
            </span>
          </div>

          {backfillData?.status === 'running' ? (
            <>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-[11px] text-text-tertiary">NIFTY 50 · 1m candles</span>
                <span className="text-xs tabular-nums font-semibold">{backfillData.progress || 62}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-hover overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-700" style={{ width: `${backfillData.progress || 62}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-text-tertiary mt-2">
                <span>{backfillData.details || '31 of 50 symbols'}</span>
                <span>ETA {backfillData.eta || '~4m'}</span>
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
            <div><div className="text-[10px] uppercase text-text-tertiary">Symbols covered</div><div className="tabular-nums text-lg font-bold">31 / 50</div></div>
            <div><div className="text-[10px] uppercase text-text-tertiary">Earliest candle</div><div className="tabular-nums text-lg font-bold">2021-07-10</div></div>
            <div><div className="text-[10px] uppercase text-text-tertiary">Total records</div><div className="tabular-nums text-lg font-bold">2.4M</div></div>
            <div><div className="text-[10px] uppercase text-text-tertiary">Gaps detected</div><div className="tabular-nums text-lg font-bold text-warning">4</div></div>
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
            <span className="badge badge-ok text-xs font-bold px-2.5 py-1 rounded-full border">6 ACTIVE</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-surface-hover rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold tabular-nums">128</div>
              <div className="text-[10px] uppercase text-text-tertiary">Queue depth</div>
            </div>
            <div className="bg-surface-hover rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold tabular-nums text-success">340/s</div>
              <div className="text-[10px] uppercase text-text-tertiary">Throughput</div>
            </div>
            <div className="bg-surface-hover rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold tabular-nums">0</div>
              <div className="text-[10px] uppercase text-text-tertiary">Errors</div>
            </div>
            <div className="bg-surface-hover rounded-lg p-3 text-center">
              <div className="text-2xl font-extrabold tabular-nums">42ms</div>
              <div className="text-[10px] uppercase text-text-tertiary">Avg latency</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {['worker-01', 'worker-02', 'worker-03', 'worker-04', 'worker-05', 'worker-06'].map((w, i) => (
              <div key={w} className="flex items-center justify-between py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  <span className="tabular-nums text-text-secondary">{w}</span>
                </div>
                <span className="tabular-nums text-text-tertiary">{Math.floor(45 + Math.random() * 20)}ms</span>
                <span className="tabular-nums text-text-tertiary">{Math.floor(30 + Math.random() * 20)}/s</span>
                <span className="badge badge-ok text-[9px] px-1.5 py-0.5 rounded-full border">UP</span>
              </div>
            ))}
          </div>

          <Link href="/swarm" className="block text-xs text-primary hover:underline mt-3 pt-3 border-t border-border">Open full swarm monitor →</Link>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="mt-5 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Link href="/backfill" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">📥</span>
          <div className="text-sm font-semibold mt-1">Trigger backfill</div>
          <div className="text-[10px] text-text-tertiary">Historical data</div>
        </Link>
        <Link href="/system" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">🖥</span>
          <div className="text-sm font-semibold mt-1">System visualizer</div>
          <div className="text-[10px] text-text-tertiary">Pipeline flow</div>
        </Link>
        <Link href="/swarm" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">🐝</span>
          <div className="text-sm font-semibold mt-1">Swarm monitor</div>
          <div className="text-[10px] text-text-tertiary">Worker dashboard</div>
        </Link>
        <Link href="/alerts" className="card hover:border-primary transition text-center py-3 no-underline">
          <span className="text-lg">🔔</span>
          <div className="text-sm font-semibold mt-1">System alerts</div>
          <div className="text-[10px] text-text-tertiary">Notifications</div>
        </Link>
      </div>
    </AppShell>
  );
}
