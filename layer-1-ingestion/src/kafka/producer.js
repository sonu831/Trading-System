/**
 * Kafka Producer - Publishes normalized ticks to Kafka
 *
 * Features:
 * - Symbol-based partitioning (50 partitions for 50 stocks)
 * - Batch sending for efficiency
 * - Exactly-once semantics support
 */

const { Kafka, Partitioners } = require('kafkajs');
const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');
const symbolConfig = require('../../config/symbols.json');

class KafkaProducer {
  constructor(options) {
    this.brokers = options.brokers;
    this.topic = options.topic;
    this.connected = false;

    // Create symbol to partition mapping
    this.symbolPartitionMap = {};
    symbolConfig.nifty50.forEach((symbol, index) => {
      this.symbolPartitionMap[symbol.symbol] = index;
    });

    // Initialize Kafka client
    this.kafka = new Kafka({
      clientId: 'nifty50-ingestion',
      brokers: this.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 8,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      // Removed idempotent and transactionalId - causes hangs in single-broker setup
      // acks: 1 means leader acknowledgment only (faster, suitable for market data)
    });
  }

  /**
   * Connect to Kafka
   */
  async connect() {
    try {
      await this.producer.connect();
      this.connected = true;
      logger.info(`Kafka producer connected to: ${this.brokers.join(', ')}`);
    } catch (error) {
      logger.error('Failed to connect to Kafka:', error);
      throw error;
    }
  }

  /**
   * Send normalized tick to Kafka
   * @param {Object} tick - Normalized tick data
   */
  async send(tick) {
    if (!this.connected) {
      throw new Error('Producer not connected');
    }

    try {
      // Get partition based on symbol
      const partition = this.symbolPartitionMap[tick.symbol] || 0;

      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: tick.symbol,
            value: JSON.stringify(tick),
            partition: partition,
            timestamp: tick.timestamp.toString(),
            headers: {
              source: 'ingestion-layer',
              version: '1.0',
            },
          },
        ],
      });

      metrics.kafkaMessagesSent.inc({ topic: this.topic });
    } catch (error) {
      logger.error('Failed to send message to Kafka:', error);
      metrics.errorCounter.inc({ type: 'kafka_send' });
      throw error;
    }
  }

  /**
   * Send batch of ticks
   * @param {Array} ticks - Array of normalized ticks
   */
  async sendBatch(ticks) {
    if (!this.connected) {
      throw new Error('Producer not connected');
    }

    const messages = ticks.map((tick) => ({
      key: tick.symbol,
      value: JSON.stringify(tick),
      partition: this.symbolPartitionMap[tick.symbol] || 0,
      timestamp: tick.timestamp.toString(),
    }));

    await this.producer.send({
      topic: this.topic,
      messages: messages,
    });

    metrics.kafkaMessagesSent.inc({ topic: this.topic }, ticks.length);
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect() {
    await this.producer.disconnect();
    this.connected = false;
    logger.info('Kafka producer disconnected');
  }
}

module.exports = { KafkaProducer };
