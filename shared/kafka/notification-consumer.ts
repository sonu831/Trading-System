/**
 * Kafka Notification Consumer
 *
 * Shared module for consuming notification messages from Kafka.
 * Provides at-least-once delivery with automatic retry and DLQ routing.
 *
 * Features:
 * - Consumer group support for horizontal scaling
 * - Channel-based message filtering (telegram, email)
 * - Automatic retry with exponential backoff
 * - Dead Letter Queue for failed messages
 * - Graceful shutdown with offset commit
 */

const { Kafka, logLevel } = require('kafkajs');
const { getNotificationProducer, NOTIFICATION_TOPIC } = require('./notification-producer');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',');
const MAX_RETRIES = parseInt(process.env.KAFKA_MAX_RETRIES || '3', 10);

class NotificationConsumer {
  /**
   * Create a notification consumer
   *
   * @param {Object} options - Consumer options
   * @param {string} options.groupId - Kafka consumer group ID
   * @param {string} options.consumerName - Name identifying this consumer (for DLQ)
   * @param {string} [options.targetChannel] - Channel to filter: 'telegram', 'email', or null for all
   * @param {Object} [options.logger] - Logger instance
   */
  constructor(options) {
    this.groupId = options.groupId;
    this.consumerName = options.consumerName;
    this.targetChannel = options.targetChannel || null;
    this.brokers = options.brokers || KAFKA_BROKERS;
    this.topic = options.topic || NOTIFICATION_TOPIC;
    this.logger = options.logger || console;
    this.messageHandlers = new Map();
    this.running = false;

    this.kafka = new Kafka({
      clientId: `${this.consumerName}-consumer`,
      brokers: this.brokers,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    // Get producer for DLQ
    this.producer = getNotificationProducer({ logger: this.logger });
  }

  /**
   * Register a handler for a specific notification type
   *
   * @param {string} type - Notification type to handle
   * @param {Function} handler - Async function(payload) to process the notification
   */
  on(type, handler) {
    this.messageHandlers.set(type, handler);
    return this;
  }

  /**
   * Start consuming messages
   */
  async start() {
    try {
      await this.consumer.connect();
      this.logger.info?.(`✅ Kafka NotificationConsumer [${this.consumerName}] connected`);

      await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
      this.logger.info?.(`📡 Subscribed to topic: ${this.topic}`);

      this.running = true;

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this._processMessage(message);
        },
      });
    } catch (error) {
      this.logger.error?.({ err: error }, '❌ Failed to start Kafka NotificationConsumer');
      throw error;
    }
  }

  /**
   * Process a single message
   * @private
   */
  async _processMessage(message) {
    let notification;

    try {
      notification = JSON.parse(message.value.toString());
    } catch (parseError) {
      this.logger.error?.({ err: parseError }, '❌ Failed to parse notification message');
      return;
    }

    const { id, type, channel, payload, retryCount = 0 } = notification;

    // Check if this message is for our channel
    if (this.targetChannel && channel !== 'both' && channel !== this.targetChannel) {
      // Message not for us, skip
      return;
    }

    const handler = this.messageHandlers.get(type);
    if (!handler) {
      this.logger.debug?.({ type, id }, 'No handler registered for notification type');
      return;
    }

    try {
      this.logger.info?.({ id, type, channel }, `📥 Processing notification`);
      await handler(payload, notification);
      this.logger.info?.({ id, type }, `✅ Notification processed successfully`);
    } catch (error) {
      this.logger.error?.({ err: error, id, type }, '❌ Failed to process notification');

      // Retry logic
      if (retryCount < MAX_RETRIES) {
        // Re-publish with incremented retry count
        notification.retryCount = retryCount + 1;
        notification.lastError = error.message;

        try {
          await this.producer.send({
            type,
            channel,
            payload,
            key: id,
          });
          this.logger.warn?.(
            { id, type, retryCount: notification.retryCount },
            '🔄 Message re-queued for retry'
          );
        } catch (retryError) {
          this.logger.error?.({ err: retryError }, '❌ Failed to re-queue message');
        }
      } else {
        // Send to DLQ after max retries
        await this.producer.sendToDLQ(notification, error.message, this.consumerName);
      }
    }
  }

  /**
   * Stop the consumer gracefully
   */
  async stop() {
    this.running = false;
    await this.consumer.disconnect();
    this.logger.info?.(`🛑 NotificationConsumer [${this.consumerName}] disconnected`);
  }
}

module.exports = { NotificationConsumer };
