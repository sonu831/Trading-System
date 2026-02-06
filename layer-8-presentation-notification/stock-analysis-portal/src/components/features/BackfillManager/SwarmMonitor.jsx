import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../../ui';

const POLL_INTERVAL = 2000; // 2 seconds

/**
 * SwarmMonitor Component
 * 
 * Displays the current status of the Backfill Swarm and Real-Time Database Sync.
 * 
 * Features:
 * 1. Polls Swarm Status (`/api/v1/system/backfill/swarm/status`)
 * 2. Polls Live DB Count (`/api/v1/data/stats`)
 * 3. Fetches Expected Total (`/api/v1/data/availability`) to calculate progress %
 * 
 * @param {Function} onRefresh - Callback to refresh parent data when backfill completes
 * @param {boolean} showEmpty - Whether to show the idle state card
 */
export default function SwarmMonitor({ onRefresh, showEmpty = false }) {
  const [swarmState, setSwarmState] = useState(null);
  const [dbStats, setDbStats] = useState({ candles_1m: 0 }); // Current DB Row Count
  const [dbTotal, setDbTotal] = useState(0); // Expected Total Records (for progress calc)
  const [loading, setLoading] = useState(false);

  // Poll for Swarm Status & DB Stats
  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        // Parallel Fetch: 
        // 1. Swarm Status: Current active job status
        // 2. DB Stats: Live row count from candles_1m table
        // 3. Availability: Metadata to determine "Total expected rows"
        const [swarmRes, statsRes, availRes] = await Promise.all([
          fetch('/api/v1/system/backfill/swarm/status'),
          fetch('/api/v1/data/stats'),
          fetch('/api/v1/data/availability')
        ]);

        // Process Swarm Status
        if (swarmRes.ok) {
          const response = await swarmRes.json();
          const swarmData = response.data || response;
          setSwarmState(swarmData);
          
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
        // Note: The API response structure varies (summary object vs array of symbols).
        // We handle both cases to robustly find the 'Total Records' count.
        if (availRes.ok) {
           const availResponse = await availRes.json();
           const payload = availResponse.data || {};
           
           let total = 0;
           // Case A: Summary object exists (Backend pre-calculated)
           if (payload.summary && payload.summary.totalRecords) {
              total = Number(payload.summary.totalRecords);
           } 
           // Case B: Array of symbols (Frontend must sum up)
           else if (Array.isArray(payload.symbols)) {
              total = payload.symbols.reduce((acc, curr) => acc + Number(curr.total_candles || curr.total_records || 0), 0);
           }
           
           setDbTotal(total);
        }

      } catch (e) {
        console.warn('Swarm/Stats Poll Failed:', e);
      }
    };

    fetchStatus(); // Initial fetch
    intervalId = setInterval(fetchStatus, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, []); // Empty dependency array = mount only

  // Helper Component for DB Sync Card
  const DbSyncCard = () => {
     // Calculate Progress
     const progress = dbTotal > 0 ? Math.min(100, (dbStats.candles_1m / dbTotal) * 100) : 0;
     
     // Determine if active (simple heuristic: if we have stats and not complete)
     const isActive = dbStats.candles_1m > 0 && progress < 100;
     const isComplete = progress >= 100;

     return (
        <Card className="bg-surface border-border mb-6 p-0 overflow-hidden relative shadow-lg group">
           {/* Background Gradient Animation for Active State */}
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

             {/* Progress Bar Container */}
             <div className="relative w-full h-5 bg-surface-hover rounded-full overflow-hidden border border-border/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
                {/* Filling Bar */}
                <div 
                  className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-success' : 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'}`}
                  style={{ width: `${progress}%`, boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)' }}
                >
                   {/* Striped Animation */}
                   {isActive && (
                      <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1.5rem_1.5rem] animate-[progress-pulse_1s_linear_infinite]" />
                   )}
                   
                   {/* Glare effect */}
                   <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/30" />
                </div>
             </div>
             
             {/* Footer Stats */}
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

  if (!swarmState || swarmState.status === 'IDLE') {
    if (showEmpty) {
      return (
        <div className="space-y-6">
           {/* Show DB Sync even when idle */}
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
  const completedCount = (partitions || []).filter(p => p.status === 'COMPLETED').length;
  const progressPercent = totalPartitions > 0 ? Math.round((completedCount / totalPartitions) * 100) : 0;
  const duration = Math.floor((Date.now() - startTime) / 1000);

  const isRetrying = status === 'RETRYING' || status === 'COMPLETED_WITH_ERRORS';

  return (
    <div className="mb-6">
      <DbSyncCard />

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
              Strategy: <strong>{strategy}</strong> • Duration: {duration}s
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-primary">{progressPercent}%</div>
            <div className="text-xs text-text-tertiary">Completion</div>
          </div>
        </div>

      {/* Grid of Workers */}
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
