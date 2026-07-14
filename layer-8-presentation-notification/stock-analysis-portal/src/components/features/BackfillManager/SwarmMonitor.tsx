// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@/components/ui';

const POLL_INTERVAL = 2000; // 2 seconds

// After-hours window: only allow backfill outside market hours (9:15 AM - 3:30 PM IST)
function isAfterHours() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 3600000);
  const day = ist.getUTCDay();
  const hours = ist.getUTCHours();
  const minutes = ist.getUTCMinutes();
  const timeInMinutes = hours * 60 + minutes;
  const isWeekend = day === 0 || day === 6;
  const marketOpenTime = 9 * 60 + 15;  // 09:15
  const marketCloseTime = 15 * 60 + 30; // 15:30
  return isWeekend || timeInMinutes < marketOpenTime || timeInMinutes > marketCloseTime;
}

// Rate limit thresholds per broker
const RATE_LIMITS = {
  mstock: { requestsPerSec: 5, maxBackoffMs: 60000 },
  flattrade: { requestsPerSec: 10, maxBackoffMs: 30000 },
  kite: { requestsPerSec: 10, maxBackoffMs: 30000 },
  indianapi: { requestsPerSec: 2, maxBackoffMs: 120000 },
};

export default function SwarmMonitor({ onRefresh, showEmpty = false }) {
  const [swarmState, setSwarmState] = useState(null);
  const [dbStats, setDbStats] = useState({ candles_1m: 0 });
  const [dbTotal, setDbTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [rateLimitInfo, setRateLimitInfo] = useState(null); // { provider, throttleMs, retryAfter }
  const [workUnits, setWorkUnits] = useState([]); // Per-symbol work unit progress

  // Poll for Swarm Status & DB Stats
  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const [swarmRes, statsRes, availRes] = await Promise.all([
          fetch('/api/v1/system/backfill/swarm/status'),
          fetch('/api/v1/data/stats'),
          fetch('/api/v1/data/availability'),
        ]);

        // Process Swarm Status
        if (swarmRes.ok) {
          const response = await swarmRes.json();
          const swarmData = response.data || response;
          setSwarmState(swarmData);

          // Extract per-symbol work units if available
          if (swarmData.workUnits || swarmData.symbolProgress) {
            setWorkUnits(swarmData.workUnits || swarmData.symbolProgress || []);
          }

          // Extract rate limit info
          if (swarmData.rateLimit || swarmData.throttleMs) {
            setRateLimitInfo({
              provider: swarmData.provider || 'mstock',
              throttleMs: swarmData.throttleMs || swarmData.rateLimit?.throttleMs || 0,
              retryAfter: swarmData.retryAfter || swarmData.rateLimit?.retryAfter || 0,
            });
          } else {
            setRateLimitInfo(null);
          }

          // Trigger parent refresh ONCE when job completes
          if (swarmData.status === 'COMPLETED' && swarmState?.status === 'RUNNING') {
            onRefresh && onRefresh();
          }
        }

        // Process Live DB Stats
        if (statsRes.ok) {
          const statsResponse = await statsRes.json();
          setDbStats(statsResponse.data || { candles_1m: 0 });
        }

        // Process Data Availability (Total Records)
        if (availRes.ok) {
          const availResponse = await availRes.json();
          const payload = availResponse.data || {};

          let total = 0;
          if (payload.summary && payload.summary.totalRecords) {
            total = Number(payload.summary.totalRecords);
          } else if (Array.isArray(payload.symbols)) {
            total = payload.symbols.reduce((acc, curr) => acc + Number(curr.total_candles || curr.total_records || 0), 0);
          }

          setDbTotal(total);
        }
      } catch (e) {
        console.warn('Swarm/Stats Poll Failed:', e);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  const DbSyncCard = () => {
    const progress = dbTotal > 0 ? Math.min(100, (dbStats.candles_1m / dbTotal) * 100) : 0;
    const isActive = dbStats.candles_1m > 0 && progress < 100;
    const isComplete = progress >= 100;

    return (
      <Card className="bg-surface border-border mb-6 p-0 overflow-hidden relative shadow-lg group">
        {isActive && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse pointer-events-none" />
        )}

        <div className="p-6 relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border backdrop-blur-sm transition-colors duration-500 ${isActive ? 'bg-primary/20 border-primary/50 text-blue-400' : 'bg-surface-hover border-border/50'}`}>
                <span className="text-2xl">🗄️</span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                  {dbStats?.candles_1m?.toLocaleString()}
                  {isComplete && <Badge variant="success" size="sm" className="shadow-glow-success">Complete</Badge>}
                </h3>
                <div className="text-[10px] text-text-tertiary uppercase tracking-wider flex items-center gap-2 font-semibold">
                  DB Sync (Rows)
                  {isActive && (
                    <span className="flex h-2.5 w-2.5 relative ml-1" title="Syncing Live">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success shadow-[0_0_8px_rgba(var(--success),0.8)]"></span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className={`text-4xl font-mono font-bold tabular-nums tracking-tight bg-clip-text text-transparent bg-gradient-to-br ${isComplete ? 'from-success to-emerald-400' : 'from-blue-400 via-purple-400 to-pink-400'}`}>
                {Math.round(progress)}%
              </div>
              <div className="text-xs text-text-secondary font-mono mt-1 opacity-80">
                {dbTotal > 0 ? `Target: ${(dbTotal / 1000000).toFixed(2)}M` : 'Calculating target...'}
              </div>
            </div>
          </div>

          <div className="relative w-full h-5 bg-surface-hover rounded-full overflow-hidden border border-border/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
            <div
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-success' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'}`}
              style={{ width: `${progress}%`, boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }}
            >
              {isActive && (
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1.5rem_1.5rem] animate-[progress-pulse_1s_linear_infinite]" />
              )}
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/30" />
            </div>
          </div>

          <div className="flex justify-between mt-3 text-xs font-mono text-text-tertiary opacity-75">
            <div className="flex items-center gap-1">
              {isActive ? (
                <span className="flex items-center gap-1 text-blue-400">
                  <span className="animate-spin text-[10px]">⟳</span> syncing live data
                </span>
              ) : (
                <span>● status: {isComplete ? <span className="text-success">ready</span> : 'waiting'}</span>
              )}
            </div>
            <div>{dbStats?.candles_1m > 0 && dbTotal > 0 ? `${((dbStats.candles_1m / dbTotal) * 100).toFixed(1)}%` : ''}</div>
          </div>
        </div>
      </Card>
    );
  };

  // After-hours guard banner
  const AfterHoursGuard = ({ isRunning }) => {
    const safe = isAfterHours();
    if (safe) return null;
    if (!isRunning) return null;
    const limit = RATE_LIMITS[swarmState?.provider] || RATE_LIMITS.mstock;
    return (
      <div className="mb-4 p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs flex items-center gap-2">
        ⚠️ Market hours active — backfill is throttled to {limit.requestsPerSec} req/s to avoid contention with live feed
      </div>
    );
  };

  if (!swarmState || swarmState.status === 'IDLE') {
    if (showEmpty) {
      return (
        <div className="space-y-6">
          <DbSyncCard />

          <Card className="border-dashed border-border p-8 text-center">
            <div className="text-4xl mb-4">💤</div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Swarm is Idle</h3>
            <p className="text-text-secondary mb-4">
              No active swarm jobs are currently running.
            </p>
            <Button variant="primary" onClick={() => window.location.href = '/backfill'}>
              Start New Backfill
            </Button>
          </Card>
        </div>
      );
    }
    return null;
  }

  const { symbol, strategy, partitions = [], totalPartitions, startTime, status, attempt = 1 } = swarmState;
  const completedCount = (partitions || []).filter((p) => p.status === 'COMPLETED').length;
  const progressPercent = totalPartitions > 0 ? Math.round((completedCount / totalPartitions) * 100) : 0;
  const duration = Math.floor((Date.now() - startTime) / 1000);
  const isRetrying = status === 'RETRYING' || status === 'COMPLETED_WITH_ERRORS';

  return (
    <div className="mb-6">
      <DbSyncCard />

      {/* After-hours guard */}
      <AfterHoursGuard isRunning={status === 'RUNNING'} />

      {/* Rate limiter status */}
      {rateLimitInfo && (
        <div className="mb-4 p-3 rounded-lg bg-info/10 border border-info/20 text-info text-xs">
          <span className="font-semibold">{rateLimitInfo.provider}</span> rate limit active
          {rateLimitInfo.throttleMs > 0 && <span> · throttle {rateLimitInfo.throttleMs}ms</span>}
          {rateLimitInfo.retryAfter > 0 && <span> · retry in {Math.ceil(rateLimitInfo.retryAfter / 1000)}s</span>}
        </div>
      )}

      <Card className={`border-primary/30 bg-primary/5 p-6 ${isRetrying ? 'border-warning/50 bg-warning/5' : ''}`}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-primary flex items-center gap-2">
              🐝 Swarm Active: {symbol}
              <Badge variant={isRetrying ? 'warning' : 'info'} size="sm">
                {status === 'RETRYING' ? `Retrying (Attempt ${attempt})` : status}
              </Badge>
            </h3>
            <p className="text-text-secondary text-sm">
              Strategy: <strong>{strategy}</strong> · Duration: {duration}s
              {attempt > 1 && <span className="text-warning ml-2">· Restarted {attempt - 1}x (resume from last work unit)</span>}
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{progressPercent}%</div>
            <div className="text-xs text-text-tertiary">Completion · {completedCount}/{totalPartitions} partitions</div>
          </div>
        </div>

        {/* Per-symbol work units — D3: not just one global %, show per-symbol chunks */}
        {workUnits.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Per-symbol Progress ({workUnits.length} symbols)
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {workUnits.map((wu) => {
                const pct = wu.total > 0 ? Math.round((wu.completed / wu.total) * 100) : 0;
                const style = wu.status === 'COMPLETED' ? 'border-success/30 bg-success/5'
                  : wu.status === 'WORKING' ? 'border-primary/30 bg-primary/5'
                    : wu.status === 'FAILED' ? 'border-error/30 bg-error/5'
                      : 'border-border bg-surface-hover';
                return (
                  <div key={wu.symbol} className={`p-2 rounded border ${style} text-xs`}>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-text-primary">{wu.symbol}</span>
                      <span className="tabular-nums text-text-tertiary">{wu.completed?.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-surface-hover overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${wu.status === 'COMPLETED' ? 'bg-success' : wu.status === 'FAILED' ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Grid of Workers (partitions) */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {partitions.map((p) => (
            <div
              key={p.id}
              className={`
                p-3 rounded border text-center transition-all duration-300
                ${p.status === 'COMPLETED' ? 'bg-success/10 border-success/30' : ''}
                ${p.status === 'WORKING' ? 'bg-warning/10 border-warning/30 animate-pulse' : ''}
                ${p.status === 'PENDING' ? 'bg-surface border-border opacity-60' : ''}
                ${p.status === 'FAILED' ? 'bg-error/10 border-error/30' : ''}
              `}
            >
              <div className="text-xs font-mono mb-1 truncate text-text-secondary">
                {new Date(p.range.split(' to ')[0]).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })}
              </div>

              <div className="font-bold text-lg">
                {p.status === 'COMPLETED' && <span className="text-success">✅</span>}
                {p.status === 'WORKING' && <span className="text-warning">⏳</span>}
                {p.status === 'PENDING' && <span className="text-text-tertiary">wait</span>}
                {p.status === 'FAILED' && <span className="text-error">❌</span>}
              </div>

              {p.candles > 0 && (
                <div className="text-xs font-mono text-primary mt-1">
                  {p.candles.toLocaleString()}
                </div>
              )}

              {p.error && (
                <div className="text-[10px] text-error truncate px-1" title={p.error}>
                  {p.error}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
