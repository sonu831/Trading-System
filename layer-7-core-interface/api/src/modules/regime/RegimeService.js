/**
 * RegimeService — reads the market regime (L6) and breadth/sectors (L5) from Redis.
 *
 * CQRS: Redis is the read path. We never query TimescaleDB for these — they are
 * recomputed continuously and only the latest value matters.
 *
 * Keys (override via env if the producers change):
 *   market-regime:latest -> RegimeState  (trend, volatility, phase, tfAlignment, tradeableTiers)
 *   market_view          -> MarketView   (breadth, sector_performance, top gainers/losers)
 *
 * A missing key is NOT an error — it means the producer hasn't published yet.
 * We return null so the dashboard can say "no data" instead of inventing a regime.
 */
class RegimeService {
  constructor({ redis }) {
    this.redis = redis;
    this.regimeKey = process.env.REDIS_REGIME_KEY || 'market-regime:latest';
    this.marketViewKey = process.env.REDIS_MARKET_VIEW_KEY || 'market_view';
  }

  /** @returns {Promise<object|null>} latest RegimeState, or null if never published */
  async getLatestRegime() {
    return (await this.redis.get(this.regimeKey)) ?? null;
  }

  /**
   * @returns {Promise<{breadth: object|null, sectors: object|null, timestamp: string|null}>}
   */
  async getLatestBreadth() {
    const view = await this.redis.get(this.marketViewKey);
    if (!view) return { breadth: null, sectors: null, timestamp: null };

    return {
      breadth: view.breadth ?? null,
      sectors: view.sector_performance ?? view.sectors ?? null,
      timestamp: view.timestamp ?? null,
    };
  }
}

module.exports = RegimeService;
