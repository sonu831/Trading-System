import { Card } from '@/components/ui';
import { useDbSync } from '@/hooks/common/useDbSync';

/**
 * DbSyncStatus Component
 * 
 * A completely standalone widget that displays the current
 * TimescaleDB ingestion status (Row Count + Active/Idle state).
 * 
 * Uses `useDbSync` hook for logic.
 */
const DbSyncStatus = ({ className = '' }) => {
  const { count, isSyncing, isLoading } = useDbSync();

  return (
    <Card className={`bg-surface border-border mb-6 p-0 overflow-hidden relative shadow-lg group ${className}`}>
        {/* Background Gradient Animation for Active State */}
        {isSyncing && (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse pointer-events-none" />
        )}
        
        <div className="p-6 relative z-10">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg border backdrop-blur-sm transition-colors duration-500 ${isSyncing ? 'bg-primary/20 border-primary/50 text-blue-400' : 'bg-surface-hover border-border/50'}`}>
                  <span className="text-2xl">🗄️</span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
                    {isLoading ? '...' : count.toLocaleString()}
                    <span className="text-sm font-normal text-text-tertiary">rows</span>
                  </h3>
                  <div className="text-[10px] text-text-tertiary uppercase tracking-wider flex items-center gap-2 font-semibold">
                    DB Ingestion
                    {isSyncing && (
                        <span className="flex h-2.5 w-2.5 relative ml-1" title="Syncing Live">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success shadow-[0_0_8px_rgba(var(--success),0.8)]"></span>
                        </span>
                    )}
                  </div>
                </div>
            </div>

            <div className="text-right">
                <div className={`text-2xl font-mono font-bold tabular-nums tracking-tight ${isSyncing ? 'text-blue-400' : 'text-text-secondary'}`}>
                  {isSyncing ? 'Active' : 'Idle'}
                </div>
                <div className="text-xs text-text-secondary font-mono mt-1 opacity-80">
                  TimescaleDB (1m Candles)
                </div>
            </div>
          </div>

          {/* Activity Bar Container */}
          <div className="relative w-full h-2 bg-surface-hover rounded-full overflow-hidden border border-border/30">
            {/* Indeterminate Loading Bar */}
            {isSyncing ? (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent w-1/2 animate-[shimmer_1.5s_infinite]" />
            ) : (
                <div className="h-full w-full bg-border/20" />
            )}
          </div>
          
          {/* Footer Stats */}
          <div className="flex justify-between mt-3 text-xs font-mono text-text-tertiary opacity-75">
            <div className="flex items-center gap-1">
                {isSyncing ? (
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="animate-spin text-[10px]">⟳</span> Receiving Data...
                  </span>
                ) : (
                  <span>● System Ready</span>
                )}
            </div>
            <div>{isSyncing ? 'Writing...' : 'Stored'}</div>
          </div>
        </div>
    </Card>
  );
};

export default DbSyncStatus;
