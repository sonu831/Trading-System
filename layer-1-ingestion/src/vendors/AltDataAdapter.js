/**
 * AltDataAdapter
 *
 * Generic adapter for alternative/scraped market data:
 * FII/DII flows, PCR from NSE website, max pain, news, global cues.
 *
 * Part of TARGET_ARCHITECTURE.md Data-Source Abstraction (§3):
 *   BrokerAdapter | MarketDataAdapter | AltDataAdapter
 *
 * RULES (non-negotiable):
 * - Advisory only -- NEVER a hard trade trigger
 * - Scrapers break, system degrades gracefully
 * - Data marked with source reliability flag
 * - Best-effort, lower cadence than market data
 */
const { logger } = require('../utils/logger');

class AltDataAdapter {
  constructor(options = {}) {
    this.name = options.name || 'alt-data';
    this.kafkaProducer = options.kafkaProducer || null;
    this.kafkaTopic = options.kafkaTopic || 'alt-data';
    this.redisClient = options.redisClient || null;
    this.pollIntervalMs = options.pollIntervalMs || 300000; // 5 min default
    this.reliability = options.reliability || 'medium'; // low | medium | high
    this.pollTimer = null;
    this.running = false;
    this.lastFetch = null;
  }

  async start() {
    this.running = true;
    logger.info(`AltDataAdapter[${this.name}]: Starting (interval=${this.pollIntervalMs}ms, reliability=${this.reliability})`);
    this.pollTimer = setInterval(() => this.fetchAndPublish(), this.pollIntervalMs);
    await this.fetchAndPublish();
  }

  /**
   * Fetch data from source and publish. Override in subclasses.
   */
  async fetch() {
    throw new Error('fetch() must be implemented by subclass');
  }

  async fetchAndPublish() {
    try {
      const data = await this.fetch();
      if (data) {
        await this.publish(data);
        this.lastFetch = Date.now();
      }
    } catch (err) {
      logger.warn(`AltDataAdapter[${this.name}]: Fetch failed, continuing: ${err.message}`);
      // Do NOT crash -- alt data is advisory, failures are expected
    }
  }

  async publish(data) {
    if (!this.kafkaProducer) return;
    try {
      await this.kafkaProducer.send({
        topic: this.kafkaTopic,
        messages: [{
          key: this.name,
          value: JSON.stringify({
            source: this.name,
            type: 'alt-data',
            reliability: this.reliability,
            data,
            fetched_at: Date.now(),
          }),
          headers: {
            source: `alt-data-${this.name}`,
            version: '1.0',
            reliability: this.reliability,
            timestamp: String(Date.now()),
          },
        }],
      });
      logger.debug(`AltDataAdapter[${this.name}]: Published to ${this.kafkaTopic}`);
    } catch (err) {
      logger.warn(`AltDataAdapter[${this.name}]: Publish failed: ${err.message}`);
    }
  }

  async stop() {
    this.running = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    logger.info(`AltDataAdapter[${this.name}]: Stopped`);
  }

  /**
   * Check if data is stale (beyond reasonable age)
   */
  isStale(maxAgeMs = 600000) {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch > maxAgeMs;
  }
}

module.exports = { AltDataAdapter };
