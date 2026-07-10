/**
 * IndiaVIXAdapter
 * 
 * Publishes India VIX from real-time ingestion to a dedicated Redis key
 * and optionally to a Kafka topic for downstream consumers.
 * 
 * VIX data flows through the standard tick pipeline (INDIAVIX symbol),
 * but this adapter extracts it for fast access by the regime engine.
 *
 * Extends: MarketDataAdapter
 */
const { MarketDataAdapter } = require('./MarketDataAdapter');
const logger = require('../utils/logger');

class IndiaVIXAdapter extends MarketDataAdapter {
  constructor(options = {}) {
    super({
      name: 'india-vix',
      ...options,
    });
    this.symbol = options.symbol || 'INDIAVIX';
  }

  /**
   * Poll Redis for the latest VIX value (set by L2 processing)
   */
  async poll() {
    try {
      if (!this.redisClient) return;

      const raw = await this.redisClient.get(`candle:${this.symbol}:1m`);
      if (!raw) {
        logger.debug('IndiaVIXAdapter: No VIX data available yet');
        return;
      }

      const candle = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const vixValue = candle.close || candle.ltp || 0;

      if (vixValue === 0) return;

      // Publish to dedicated Redis key
      await this.redisClient.set('vix:latest', JSON.stringify({
        value: vixValue,
        timestamp: Date.now(),
        symbol: this.symbol,
      }), 'EX', 60);

      // Classify VIX regime
      const regime = this.classifyVIX(vixValue);

      // Publish to Kafka for downstream (analysis, regime engine)
      await this.produce({
        type: 'vix',
        symbol: this.symbol,
        value: vixValue,
        regime,
        timestamp: Date.now(),
      });

      logger.debug(`IndiaVIXAdapter: VIX=${vixValue.toFixed(2)} (${regime})`);
    } catch (err) {
      logger.error(`IndiaVIXAdapter: Poll failed: ${err.message}`);
    }
  }

  /**
   * Classify VIX level into volatility regime
   */
  classifyVIX(value) {
    if (value < 12) return 'LOW_VOL';
    if (value < 20) return 'NORMAL';
    if (value < 30) return 'HIGH_VOL';
    return 'EXTREME_VOL';
  }
}

module.exports = { IndiaVIXAdapter };
