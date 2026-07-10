const logger = require('../utils/logger');

class StrategyRouter {
  constructor(registry) {
    this.registry = registry;
    this.lastRegime = null;
  }

  updateRegime(regimeState) {
    this.lastRegime = regimeState;
  }

  selectStrategies() {
    if (!this.lastRegime) {
      return this.registry.getEnabled();
    }

    const regime = this.lastRegime.trend;
    const tiers = this.lastRegime.tradeableTiers || [];
    const volatility = this.lastRegime.volatility;

    const candidates = this.registry.getByRegimeAffinity(regime);

    // Filter by tradeable tiers from regime engine
    const filtered = candidates.filter(s => {
      if (tiers.length === 0) return false;
      if (s.tier === 'T1') return tiers.includes('T1');
      if (s.tier === 'T2') return tiers.includes('T2') || tiers.includes('T1');
      if (s.tier === 'T3') return tiers.includes('T3');
      return true;
    });

    // In HIGH volatility, only allow strategies that explicitly opt-in
    if (volatility === 'HIGH') {
      return filtered.filter(s => s.params.highVolOk === true);
    }

    return filtered;
  }

  async evaluate(ctx) {
    const strategies = this.selectStrategies();
    if (strategies.length === 0) return [];

    const signals = [];

    for (const strategy of strategies) {
      strategy.stats.evaluations++;
      try {
        const signal = strategy.evaluateEntry(ctx);
        if (signal) {
          strategy.stats.signals++;
          strategy.stats.lastSignalAt = new Date().toISOString();
          signals.push({
            ...signal,
            strategyId: strategy.id,
            strategyVersion: strategy.version,
            tier: strategy.tier,
            regime: this.lastRegime || ctx.regime,
          });
        }
      } catch (err) {
        logger.error({ err, strategy: strategy.id }, 'Strategy evaluation error');
      }
    }

    return signals;
  }

  getState() {
    return {
      activeStrategies: this.selectStrategies().map(s => s.id),
      lastRegime: this.lastRegime,
    };
  }
}

module.exports = { StrategyRouter };
