/**
 * Latency Tracker — HFT-grade timing instrumentation.
 * 
 * Stamps every stage with process.hrtime.bigint() for nanosecond precision.
 * Tracks p50 and p99, not averages. Regressions live in the tail.
 */
const promClient = require('prom-client');

const stages = ['signal_rcvd', 'risk_check', 'instrument', 'quote', 'entry_sent', 'entry_fill', 'sl_placed', 'total'] as const;
type Stage = typeof stages[number];

class LatencyTracker {
  private histograms: Record<Stage, any>;
  private active: Map<string, { start: bigint; stages: Record<string, bigint> }>;

  constructor(register?: any) {
    this.histograms = {} as Record<Stage, any>;
    this.active = new Map();

    for (const s of stages) {
      this.histograms[s] = new promClient.Histogram({
        name: `execution_latency_${s}_seconds`,
        help: `Latency from signal reception to ${s} completion`,
        buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
        registers: register ? [register] : undefined,
      });
    }
  }

  start(signalId: string): void {
    this.active.set(signalId, { start: process.hrtime.bigint(), stages: {} });
  }

  stamp(signalId: string, stage: Stage): void {
    const entry = this.active.get(signalId);
    if (!entry) return;
    const elapsed = Number(process.hrtime.bigint() - entry.start) / 1e9;
    this.histograms[stage]?.observe(elapsed);
    entry.stages[stage] = process.hrtime.bigint();
  }

  finish(signalId: string, success: boolean): void {
    const entry = this.active.get(signalId);
    if (entry) {
      this.stamp(signalId, 'total');
      this.active.delete(signalId);
    }
  }

  getStageNames(): string[] { return [...stages]; }
}

export { LatencyTracker };

// Singleton for LiveExecutor
export const latency = new LatencyTracker();
