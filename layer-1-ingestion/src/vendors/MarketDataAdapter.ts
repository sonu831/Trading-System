/**
 * MarketDataAdapter — generic adapter for non-broker data sources.
 * VIX, option feeds, indices plug in via this contract.
 * TARGET_ARCHITECTURE.md §3: BrokerAdapter | MarketDataAdapter | AltDataAdapter
 */
const logger = require('../utils/logger');

interface KafkaMessage {
  key: string;
  value: string;
  headers: Record<string, string>;
}

interface KafkaProducer {
  send(msg: { topic: string; messages: KafkaMessage[] }): Promise<void>;
}

interface MarketData {
  symbol?: string;
  type?: string;
  [key: string]: unknown;
}

class MarketDataAdapter {
  name: string;
  kafkaProducer: KafkaProducer | null;
  kafkaTopic: string;
  redisClient: any;
  pollIntervalMs: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  running: boolean;

  constructor(options: Record<string, any> = {}) {
    this.name = options.name || 'market-data-adapter';
    this.kafkaProducer = options.kafkaProducer || null;
    this.kafkaTopic = options.kafkaTopic || 'market-data';
    this.redisClient = options.redisClient || null;
    this.pollIntervalMs = options.pollIntervalMs || 30000;
    this.pollTimer = null;
    this.running = false;
  }

  async start(): Promise<void> {
    this.running = true;
    logger.info(`MarketDataAdapter[${this.name}]: Starting (interval=${this.pollIntervalMs}ms)`);
    this.pollTimer = setInterval(() => this.poll(), this.pollIntervalMs);
    await this.poll();
  }

  async poll(): Promise<void> {
    throw new Error('poll() must be implemented by subclass');
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    logger.info(`MarketDataAdapter[${this.name}]: Stopped`);
  }

  async produce(data: MarketData): Promise<void> {
    if (!this.kafkaProducer) return;
    try {
      await this.kafkaProducer.send({
        topic: this.kafkaTopic,
        messages: [{
          key: String(data.symbol || data.type || this.name),
          value: JSON.stringify(data),
          headers: { source: `market-data-${this.name}`, version: '1.0', timestamp: String(Date.now()) },
        }],
      });
    } catch (err: any) {
      logger.error(`MarketDataAdapter[${this.name}]: Kafka produce failed: ${err.message}`);
    }
  }
}

module.exports = { MarketDataAdapter };
export type { KafkaProducer, MarketData };
