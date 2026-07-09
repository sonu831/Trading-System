class BaseStrategy {
  constructor(config = {}) {
    this.id = config.id;
    this.version = config.version || '1.0';
    this.tier = config.tier; // T1 | T2 | T3
    this.enabled = config.enabled !== false;
    this.regimeAffinity = config.regimeAffinity || [];
    this.params = config.params || {};
    this.description = config.description || '';
    this.stats = { evaluations: 0, signals: 0, lastSignalAt: null };
  }

  evaluateEntry(ctx) {
    throw new Error(`${this.id}: evaluateEntry() must be implemented`);
  }

  managePosition(position, ctx) {
    return { action: 'HOLD' };
  }

  getConfig() {
    return {
      id: this.id,
      version: this.version,
      tier: this.tier,
      enabled: this.enabled,
      regimeAffinity: this.regimeAffinity,
      params: this.params,
      description: this.description,
    };
  }
}

module.exports = { BaseStrategy };
