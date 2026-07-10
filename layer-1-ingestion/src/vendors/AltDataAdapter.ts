/**
 * AltDataAdapter — advisory data sources (FII/DII, PCR scrapers, news).
 * Fragile sources must never block trading. Failures degrade gracefully.
 */
const { logger } = require('../utils/logger');
import type { KafkaProducer } from './MarketDataAdapter';

interface AltDataPoint {
  [key: string]: unknown;
}

type Reliability = 'low' | 'medium' | 'high';

class AltDataAdapter {
  name: string;
  kafkaProducer: KafkaProducer | null;
  kafkaTopic: string;
  redisClient: any;
  pollIntervalMs: number;
  reliability: Reliability;
  pollTimer: ReturnType<typeof setInterval> | null;
  running: boolean;
  lastFetch: number | null;

  constructor(options: Record<string, any> = {}) {
    this.name = options.name || 'alt-data';
    this.kafkaProducer = options.kafkaProducer || null;
    this.kafkaTopic = options.kafkaTopic || 'alt-data';
    this.redisClient = options.redisClient || null;
    this.pollIntervalMs = options.pollIntervalMs || 300000;
    this.reliability = options.reliability || 'medium';
    this.pollTimer = null;
    this.running = false;
    this.lastFetch = null;
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info(`AltDataAdapter[${this.name}]: Starting (interval=${this.pollIntervalMs}ms, reliability=${this.reliability})`);
    this.pollTimer = setInterval(() => this.fetchAndPublish(), this.pollIntervalMs);
    await this.fetchAndPublish();
  }

  async fetch(): Promise<AltDataPoint | null> {
    throw new Error('fetch() must be implemented by subclass');
  }

  async fetchAndPublish(): Promise<void> {
    try {
      const data = await this.fetch();
      if (data) { await this.publish(data); this.lastFetch = Date.now(); }
    } catch (err: any) {
      logger.warn(`AltDataAdapter[${this.name}]: Fetch failed: ${err.message}`);
      // Do NOT crash — alt data is advisory
    }
  }

  async publish(data: AltDataPoint): Promise<void> {
    if (!this.kafkaProducer) return;
    try {
      await this.kafkaProducer.send({
        topic: this.kafkaTopic,
        messages: [{
          key: this.name,
          value: JSON.stringify({
            source: this.name, type: 'alt-data', reliability: this.reliability,
            data, fetched_at: Date.now(),
          }),
          headers: { source: `alt-data-${this.name}`, version: '1.0', reliability: this.reliability },
        }],
      });
    } catch (err: any) {
      logger.warn(`AltDataAdapter[${this.name}]: Publish failed: ${err.message}`);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
  }

  isStale(maxAgeMs: number = 600000): boolean {
    if (!this.lastFetch) return true;
    return Date.now() - this.lastFetch > maxAgeMs;
  }
}

export = { AltDataAdapter };
export type { Reliability, AltDataPoint };
