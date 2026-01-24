const redis = require('../core/redis');
const logger = require('../core/logger');

class MarketService {
  constructor() {
    this.redis = redis;
  }

  async getMarketSnapshot() {
    try {
      const data = await this.redis.get('market_view:latest');
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      logger.error({ err }, 'Error fetching market snapshot');
      return null;
    }
  }

  formatStock(s) {
    const change = s.change_pct ? s.change_pct.toFixed(2) : '0.00';
    const price = s.ltp ? s.ltp.toLocaleString('en-IN') : '0';
    // Add arrow
    const arrow = s.change_pct >= 0 ? '🟢' : '🔴';
    return `${arrow} *${s.symbol}*: ${change}% (₹${price})`;
  }

  async getTopGainers(limit = 10) {
    const market = await this.getMarketSnapshot();
    if (!market || !market.top_gainers) return [];
    return market.top_gainers.slice(0, limit);
  }

  async getTopLosers(limit = 10) {
    const market = await this.getMarketSnapshot();
    if (!market || !market.top_losers) return [];
    return market.top_losers.slice(0, limit);
  }

  async getMostActive(limit = 10) {
    const market = await this.getMarketSnapshot();
    if (!market) return [];
    // Prefer most_active, fallback to gainers if missing
    const movers = market.most_active || market.top_gainers || [];
    return movers.slice(0, limit);
  }
}

module.exports = new MarketService();
