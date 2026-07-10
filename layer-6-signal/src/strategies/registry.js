const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const STRATEGY_CONFIG_PATH = process.env.STRATEGY_CONFIG_PATH || path.join(__dirname, 'config.json');

class StrategyRegistry {
  constructor() {
    this.strategies = new Map();
    this.loaded = false;
  }

  register(strategy) {
    this.strategies.set(strategy.id, strategy);
    logger.info({ id: strategy.id, tier: strategy.tier },
      `Strategy registered: ${strategy.id} (${strategy.tier})`);
  }

  get(id) {
    return this.strategies.get(id) || null;
  }

  getAll() {
    return Array.from(this.strategies.values());
  }

  getEnabled() {
    return this.getAll().filter(s => s.enabled);
  }

  getByTier(tier) {
    return this.getEnabled().filter(s => s.tier === tier);
  }

  getByRegimeAffinity(regime) {
    return this.getEnabled().filter(s => {
      if (!s.regimeAffinity || s.regimeAffinity.length === 0) return true;
      return s.regimeAffinity.includes(regime);
    });
  }

  loadConfig(configPath) {
    try {
      const resolvedPath = configPath || STRATEGY_CONFIG_PATH;
      if (fs.existsSync(resolvedPath)) {
        const raw = fs.readFileSync(resolvedPath, 'utf-8');
        const config = JSON.parse(raw);
        if (config.strategies) {
          for (const entry of config.strategies) {
            const strategy = this.get(entry.id);
            if (strategy) {
              strategy.enabled = entry.enabled !== false;
              if (entry.params) Object.assign(strategy.params, entry.params);
              if (entry.regimeAffinity) strategy.regimeAffinity = entry.regimeAffinity;
              logger.info({ id: strategy.id, enabled: strategy.enabled },
                `Strategy config applied: ${strategy.id}`);
            }
          }
        }
        logger.info(`Strategy config loaded from ${resolvedPath}`);
      } else {
        logger.info('No strategy config file — using defaults');
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to load strategy config');
    }

    this.loaded = true;
  }

  reload() {
    this.loadConfig();
  }

  getStats() {
    const all = this.getAll();
    return {
      total: all.length,
      enabled: all.filter(s => s.enabled).length,
      byTier: { T1: all.filter(s => s.tier === 'T1').length, T2: all.filter(s => s.tier === 'T2').length, T3: all.filter(s => s.tier === 'T3').length },
      strategies: all.map(s => ({
        id: s.id, tier: s.tier, enabled: s.enabled,
        regimeAffinity: s.regimeAffinity,
        signals: s.stats.signals,
        evaluations: s.stats.evaluations,
      })),
    };
  }
}

module.exports = { StrategyRegistry };
