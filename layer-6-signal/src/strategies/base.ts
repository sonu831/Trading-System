/**
 * BaseStrategy — abstract strategy contract.
 * All strategy plugins extend this.
 */

interface StrategyConfig {
  id: string;
  version?: string;
  tier: string; // T1 | T2 | T3
  enabled?: boolean;
  regimeAffinity?: string[];
  params?: Record<string, number | string>;
  description?: string;
}

interface StrategyStats {
  evaluations: number;
  signals: number;
  lastSignalAt: string | null;
}

interface EvaluationContext {
  candles: Record<string, unknown>[];
  regime: Record<string, unknown>;
  breadth: Record<string, unknown>;
  timestamp: string;
}

interface PositionContext {
  id: string;
  entryPrice: number;
  direction: string;
  quantity: number;
  entryTime: string;
  [key: string]: unknown;
}

interface ExitResult {
  action: 'HOLD' | 'TRAIL' | 'EXIT';
  reason?: string;
  slPrice?: number;
  targetPrice?: number;
}

class BaseStrategy {
  id: string;
  version: string;
  tier: string;
  enabled: boolean;
  regimeAffinity: string[];
  params: Record<string, number | string>;
  description: string;
  stats: StrategyStats;

  constructor(config: StrategyConfig = { id: 'unknown', tier: 'T1' }) {
    this.id = config.id;
    this.version = config.version || '1.0';
    this.tier = config.tier;
    this.enabled = config.enabled !== false;
    this.regimeAffinity = config.regimeAffinity || [];
    this.params = config.params || {};
    this.description = config.description || '';
    this.stats = { evaluations: 0, signals: 0, lastSignalAt: null };
  }

  evaluateEntry(_ctx: EvaluationContext): Record<string, unknown> {
    throw new Error(`${this.id}: evaluateEntry() must be implemented`);
  }

  managePosition(_position: PositionContext, _ctx: EvaluationContext): ExitResult {
    return { action: 'HOLD' };
  }

  getConfig(): StrategyConfig {
    return {
      id: this.id, version: this.version, tier: this.tier,
      enabled: this.enabled, regimeAffinity: this.regimeAffinity,
      params: this.params, description: this.description,
    };
  }
}

export = { BaseStrategy };
export type { StrategyConfig, EvaluationContext, PositionContext, ExitResult };
