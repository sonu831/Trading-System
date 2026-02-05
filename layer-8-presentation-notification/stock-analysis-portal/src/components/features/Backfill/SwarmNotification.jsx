import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, Badge, Button } from '../../ui';

const POLL_INTERVAL = 5000; // Poll less frequently for global notification

export default function SwarmNotification() {
  const [swarmState, setSwarmState] = useState(null);

  useEffect(() => {
    let intervalId;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/v1/system/backfill/swarm/status');
        if (res.ok) {
          const data = await res.json();
          // Only show if RUNNING
          if (data && data.status === 'RUNNING') {
            setSwarmState(data);
          } else {
            setSwarmState(null);
          }
        }
      } catch (e) {
        // Silently fail for notifications
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, []);

  if (!swarmState) return null;

  const { symbol, strategy, partitions, totalPartitions } = swarmState;
  const completedCount = partitions.filter(p => p.status === 'COMPLETED').length;
  const progressPercent = Math.round((completedCount / totalPartitions) * 100);

  return (
    <div className="mb-6">
      <Link href="/swarm">
        <a className="block hover:opacity-95 transition-opacity">
          <Card className="bg-primary/10 border-primary/30 p-4 flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="text-2xl animate-pulse">🐝</div>
              <div>
                <h4 className="font-bold text-primary flex items-center gap-2">
                  Swarm Backfill Active: {symbol}
                  <Badge variant="warning" size="sm" className="animate-pulse">Live</Badge>
                </h4>
                <p className="text-xs text-text-secondary">
                  Strategy: {strategy} • {completedCount}/{totalPartitions} Workers Done
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-xl font-bold text-primary">{progressPercent}%</div>
                <div className="text-[10px] text-text-tertiary uppercase">Complete</div>
              </div>
              <Button size="sm" variant="primary">
                View Dashboard →
              </Button>
            </div>
          </Card>
        </a>
      </Link>
    </div>
  );
}
