/**
 * Kafka Notification Producer
 *
 * Shared module for publishing notification messages to Kafka.
 * Provides durable messaging with at-least-once delivery semantics.
 *
 * Features:
 * - Standardized notification message format
 * - Channel-based routing (telegram, email, both)
 * - Automatic retry and error handling
 * - UUID-based message deduplication
 */

const { Kafka, logLevel } = require('kafkajs');
const crypto = require('crypto');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',');
const NOTIFICATION_TOPIC = process.env.KAFKA_NOTIFICATION_TOPIC || 'notifications';
const DLQ_TOPIC = process.env.KAFKA_NOTIFICATION_DLQ_TOPIC || 'notifications-dlq';

class NotificationProducer {
  constructor(options = {}) {
    this.clientId = options.clientId || 'notification-producer';
    this.brokers = options.brokers || KAFKA_BROKERS;
    this.topic = options.topic || NOTIFICATION_TOPIC;
    this.dlqTopic = options.dlqTopic || DLQ_TOPIC;
    this.connected = false;
    this.logger = options.logger || console;

    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 100,
        retries: 5,
      },
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      idempotent: true,
      maxInFlightRequests: 5,
    });
  }

  /**
   * Connect to Kafka
   */
  async connect() {
    if (this.connected) return;

    try {
      await this.producer.connect();
      this.connected = true;
      this.logger.info?.(`✅ Kafka NotificationProducer connected to: ${this.brokers.join(', ')}`);
    } catch (error) {
      this.logger.error?.({ err: error }, '❌ Failed to connect Kafka NotificationProducer');
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect() {
    if (!this.connected) return;

    await this.producer.disconnect();
    this.connected = false;
    this.logger.info?.('🛑 Kafka NotificationProducer disconnected');
  }

  /**
   * Publish a notification message to Kafka
   *
   * @param {Object} options - Notification options
   * @param {string} options.type - Notification type: bot_restart, system_down, system_up, suggestion, backfill, alert
   * @param {string} [options.channel='both'] - Target channel: telegram, email, both
   * @param {Object} options.payload - Notification payload data
   * @param {string} [options.key] - Optional message key for partitioning
   * @returns {Promise<void>}
   */
  async send({ type, channel = 'both', payload, key }) {
    if (!this.connected) {
      await this.connect();
    }

    const message = {
      id: crypto.randomUUID(),
      type,
      channel,
      payload,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    try {
      await this.producer.send({
        topic: this.topic,
        messages: [
          {
            key: key || type,
            value: JSON.stringify(message),
            headers: {
              type,
              channel,
              source: this.clientId,
            },
          },
        ],
      });

      this.logger.info?.({ messageId: message.id, type, channel }, '📤 Notification sent to Kafka');
    } catch (error) {
      this.logger.error?.({ err: error, type, channel }, '❌ Failed to send notification to Kafka');
      throw error;
    }
  }

  /**
   * Send message to Dead Letter Queue (for failed processing)
   *
   * @param {Object} message - Original message that failed
   * @param {string} error - Error description
   * @param {string} consumer - Consumer that failed to process
   */
  async sendToDLQ(message, error, consumer) {
    if (!this.connected) {
      await this.connect();
    }

    const dlqMessage = {
      ...message,
      dlqTimestamp: new Date().toISOString(),
      error,
      failedConsumer: consumer,
    };

    try {
      await this.producer.send({
        topic: this.dlqTopic,
        messages: [
          {
            key: message.id || 'unknown',
            value: JSON.stringify(dlqMessage),
            headers: {
              originalType: message.type || 'unknown',
              failedConsumer: consumer,
            },
          },
        ],
      });

      this.logger.warn?.({ messageId: message.id, error, consumer }, '⚠️ Message sent to DLQ');
    } catch (dlqError) {
      this.logger.error?.({ err: dlqError }, '❌ Failed to send message to DLQ');
    }
  }
}

// Singleton instance for shared use
let sharedInstance = null;

/**
 * Get shared NotificationProducer instance
 * @param {Object} options - Optional configuration
 * @returns {NotificationProducer}
 */
function getNotificationProducer(options = {}) {
  if (!sharedInstance) {
    sharedInstance = new NotificationProducer(options);
  }
  return sharedInstance;
}

module.exports = {
  NotificationProducer,
  getNotificationProducer,
  NOTIFICATION_TOPIC,
  DLQ_TOPIC,
};
