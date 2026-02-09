import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '@/components/ui';
import { DbSyncStatus } from '@/components/common';

const POLL_INTERVAL = Number(process.env.NEXT_PUBLIC_BACKFILL_POLL_INTERVAL) || 30000;


/**
 * SwarmMonitor Component
 * 
 * Displays the current status of the Backfill Swarm and Real-Time Database Sync.
 * 
 * Features:
 * 1. Polls Swarm Status (`/api/v1/system/backfill/swarm/status`)
 * 2. Uses `DbSyncStatus` for live DB ingestion monitoring (decoupled)
 * 
 * @param {Function} onRefresh - Callback to refresh parent data when backfill completes
 * @param {boolean} showEmpty - Whether to show the idle state card
 */
export default function SwarmMonitor({ onRefresh, showEmpty = false }) {
  const [swarmState, setSwarmState] = useState(null);
  const [loading, setLoading] = useState(false);

  // Poll for Swarm Status
  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        // Poll Swarm Status
        const swarmRes = await fetch('/api/v1/system/backfill/swarm/status');

        if (swarmRes.ok) {
          const response = await swarmRes.json();
          const swarmData = response.data || response;
          setSwarmState(swarmData);
          
          // Trigger parent refresh ONCE when job completes
          if (swarmData.status === 'COMPLETED' && swarmState?.status === 'RUNNING') {
            onRefresh && onRefresh();
          }
        }
      } catch (e) {
        console.warn('Swarm Poll Failed:', e);
      }
    };

    fetchStatus(); // Initial fetch
    intervalId = setInterval(fetchStatus, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  if (!swarmState || swarmState.status === 'IDLE') {
    if (showEmpty) {
      return (
        <div className="space-y-6">
           {/* Show DB Sync even when idle */}
           <DbSyncStatus />
           
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
      <DbSyncStatus />

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
