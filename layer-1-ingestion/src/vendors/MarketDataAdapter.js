/**
 * MarketDataAdapter
 * 
 * Generic interface for non-broker market data sources (VIX, option feeds, indices).
 * Implementing classes pull data from NSE APIs, public feeds, or calculated sources,
 * normalize to canonical schemas, and produce to Kafka.
 *
 * Part of TARGET_ARCHITECTURE.md Data-Source Abstraction (§3):
 *   BrokerAdapter | MarketDataAdapter | AltDataAdapter
 */
const { logger } = require('../utils/logger');

class MarketDataAdapter {
  constructor(options = {}) {
    this.name = options.name || 'market-data-adapter';
    this.kafkaProducer = options.kafkaProducer || null;
    this.kafkaTopic = options.kafkaTopic || 'market-data';
    this.redisClient = options.redisClient || null;
    this.pollIntervalMs = options.pollIntervalMs || 30000;
    this.pollTimer = null;
    this.running = false;
  }

  /**
   * Start polling/producing. Override in subclasses.
   */
  async start() {
    this.running = true;
    logger.info(`MarketDataAdapter[${this.name}]: Starting (interval=${this.pollIntervalMs}ms)`);
    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs);
    await this.poll(); // Initial run
  }

  /**
   * Fetch and produce data. Override in subclasses.
   */
  async poll() {
    throw new Error('poll() must be implemented by subclass');
  }

  async stop() {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info(`MarketDataAdapter[${this.name}]: Stopped`);
  }

  /**
   * Produce normalized data to Kafka
   */
  async produce(data) {
    if (!this.kafkaProducer) return;
    try {
      await this.kafkaProducer.send({
        topic: this.kafkaTopic,
        messages: [{
          key: data.symbol || data.type || this.name,
          value: JSON.stringify(data),
          headers: { source: `market-data-${this.name}`, version: '1.0', timestamp: String(Date.now()) },
        }],
      });
    } catch (err) {
      logger.error(`MarketDataAdapter[${this.name}]: Kafka produce failed: ${err.message}`);
    }
  }
}

module.exports = { MarketDataAdapter };
