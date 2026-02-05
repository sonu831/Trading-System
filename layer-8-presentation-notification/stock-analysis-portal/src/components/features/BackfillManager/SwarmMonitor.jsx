import React, { useState, useEffect } from 'react';
import { Card, Badge, Button } from '../../ui';

const POLL_INTERVAL = 2000; // 2 seconds

export default function SwarmMonitor({ onRefresh, showEmpty = false }) {
  const [swarmState, setSwarmState] = useState(null);
  const [loading, setLoading] = useState(false);

  // Poll for Swarm Status
  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/v1/system/backfill/swarm/status'); // Calls Backend API via Next.js proxy
        if (res.ok) {
          const response = await res.json();
          // Only update if state changed significantly or first load
          const swarmData = response.data || response;
          setSwarmState(swarmData);
          
          // If complete, trigger one last refresh of the parent table
          if (data.status === 'COMPLETED' && swarmState?.status === 'RUNNING') {
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
  }, []); // Empty dependency array = mount only

  if (!swarmState || swarmState.status === 'IDLE') {
    if (showEmpty) {
      return (
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
      );
    }
    return null; // Don't show anything if no Swarm is running (for embedded view)
  }

  const { symbol, strategy, partitions = [], totalPartitions, startTime, status, attempt = 1 } = swarmState;
  const completedCount = (partitions || []).filter(p => p.status === 'COMPLETED').length;
  const progressPercent = totalPartitions > 0 ? Math.round((completedCount / totalPartitions) * 100) : 0;
  const duration = Math.floor((Date.now() - startTime) / 1000);

  const isRetrying = status === 'RETRYING' || status === 'COMPLETED_WITH_ERRORS';

  return (
    <Card className={`border-primary/30 bg-primary/5 p-6 mb-6 ${isRetrying ? 'border-warning/50 bg-warning/5' : ''}`}>
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
  );
}
