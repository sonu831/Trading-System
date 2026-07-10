/**
 * StrategyRegistry — manages pluggable trading strategies.
 * Enables/disables strategies at runtime without redeploy.
 */
const fs = require('fs');
const logger = require('../utils/logger');
import type { StrategyConfig } from './base';

interface StrategyStats { evaluations: number; signals: number; lastSignalAt: string | null; }
interface RegistryStats { total: number; enabled: number; byTier: Record<string, number>; strategies: Array<{ id: string; tier: string; enabled: boolean; regimeAffinity: string[]; signals: number; evaluations: number }>; }

class StrategyRegistry {
  strategies: Map<string, any>;
  loaded: boolean;

  constructor() { this.strategies = new Map(); this.loaded = false; }

  register(strategy: any): void {
    this.strategies.set(strategy.id, strategy);
    logger.info({ id: strategy.id, tier: strategy.tier }, `Strategy: ${strategy.id} (${strategy.tier})`);
  }

  get(id: string): any { return this.strategies.get(id) || null; }
  getAll(): any[] { return [...this.strategies.values()]; }
  getEnabled(): any[] { return this.getAll().filter((s: any) => s.enabled); }
  getByTier(tier: string): any[] { return this.getEnabled().filter((s: any) => s.tier === tier); }
  getByRegimeAffinity(regime: string): any[] {
    return this.getEnabled().filter((s: any) => !s.regimeAffinity?.length || s.regimeAffinity.includes(regime));
  }

  loadConfig(configPath?: string): void {
    try {
      const p = configPath || process.env.STRATEGY_CONFIG_PATH || require('path').join(__dirname, 'config.json');
      if (fs.existsSync(p)) {
        const config = JSON.parse(fs.readFileSync(p, 'utf-8'));
        for (const entry of (config.strategies || [])) {
          const s = this.get(entry.id);
          if (s) { s.enabled = entry.enabled !== false; if (entry.params) Object.assign(s.params, entry.params); if (entry.regimeAffinity) s.regimeAffinity = entry.regimeAffinity; }
        }
      }
    } catch (err: any) { logger.warn({ err }, 'Failed to load strategy config'); }
    this.loaded = true;
  }

  reload(): void { this.loadConfig(); }

  getStats(): RegistryStats {
    const all = this.getAll();
    return {
      total: all.length, enabled: all.filter((s: any) => s.enabled).length,
      byTier: { T1: all.filter((s: any) => s.tier === 'T1').length, T2: all.filter((s: any) => s.tier === 'T2').length, T3: all.filter((s: any) => s.tier === 'T3').length },
      strategies: all.map((s: any) => ({
        id: s.id, tier: s.tier, enabled: s.enabled, regimeAffinity: s.regimeAffinity || [],
        signals: s.stats?.signals || 0, evaluations: s.stats?.evaluations || 0,
      })),
    };
  }
}

export = { StrategyRegistry };
