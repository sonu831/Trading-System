import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '../../ui';
import { useSocket } from '../../../hooks/useSocket';

const POLL_INTERVAL = 5000;

export default function SwarmNotification() {
  const [swarmState, setSwarmState] = useState(null);
  const [stats, setStats] = useState({ inserted: 0, ignored: 0 });
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (data) => {
      if (data && data.type === 'BACKFILL_STATS') {
        // Accumulate stats or set current if it's a snapshot
        // The backend sends a snapshot of the current backfill session in global var
        setStats(data.stats);
      }
    };

    socket.on('system:notification', handleNotification);

    return () => {
      socket.off('system:notification', handleNotification);
    };
  }, [socket]);

  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/v1/system/backfill/swarm/status');
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === 'RUNNING') {
            setSwarmState(data);
          } else {
            setSwarmState(null);
            setStats({ inserted: 0, ignored: 0 }); // Reset stats when done
          }
        }
      } catch (e) {
        // Silently fail
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  if (!swarmState) return null;

  const { symbol, strategy, partitions, totalPartitions } = swarmState;
  const completedCount = partitions.filter(p => p.status === 'COMPLETED').length;
  // Calculate specific progress based on stats if available, else standard partition count
  // const progressPercent = Math.round((completedCount / totalPartitions) * 100);

  return (
    <div className="mb-6">
       <div className="block hover:opacity-95 transition-opacity">
          <Card className="bg-primary/10 border-primary/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-2xl animate-pulse">🐝</div>
              <div>
                <h4 className="font-bold text-primary flex items-center gap-2">
                  Processing: {symbol}
                  <Badge variant="warning" size="sm" className="animate-pulse">Live</Badge>
                </h4>
                <div className="text-xs text-text-secondary mt-1">
                   <span className="font-mono text-success">+{stats.inserted} Inserted</span>
                   <span className="mx-2">•</span>
                   <span className="font-mono text-warning">{stats.ignored} Duplicates</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Link href="/swarm">
                <Button size="sm" variant="primary">
                  View Swarm →
                </Button>
              </Link>
            </div>
          </Card>
       </div>
    </div>
  );
}
