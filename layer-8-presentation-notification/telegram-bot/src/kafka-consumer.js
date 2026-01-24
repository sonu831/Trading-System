/**
 * Kafka Notification Consumer for Telegram Bot
 *
 * Consumes notification messages from Kafka and broadcasts to subscribers.
 * Runs alongside Redis Pub/Sub for dual-mode operation during migration.
 */

const { Kafka, logLevel } = require('kafkajs');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',');
const NOTIFICATION_TOPIC = process.env.KAFKA_NOTIFICATION_TOPIC || 'notifications';
const DLQ_TOPIC = process.env.KAFKA_NOTIFICATION_DLQ_TOPIC || 'notifications-dlq';
const KAFKA_ENABLED = process.env.KAFKA_ENABLED !== 'false';
const MAX_RETRIES = 3;

class TelegramKafkaConsumer {
  constructor(options) {
    this.logger = options.logger || console;
    this.bot = options.bot;
    this.publisher = options.publisher; // Redis publisher for getting subscribers
    this.metricsHandlers = options.metrics || {};
    this.connected = false;

    if (!KAFKA_ENABLED) {
      this.logger.info('📭 Kafka consumer is disabled (KAFKA_ENABLED=false)');
      return;
    }

    this.kafka = new Kafka({
      clientId: 'telegram-bot-consumer',
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'telegram-notification-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
    });
  }

  /**
   * Start consuming notifications from Kafka
   */
  async start() {
    if (!KAFKA_ENABLED) return;

    try {
      await this.consumer.connect();
      await this.producer.connect();
      this.connected = true;
      this.logger.info(`✅ Kafka TelegramConsumer connected to: ${KAFKA_BROKERS.join(', ')}`);

      await this.consumer.subscribe({ topic: NOTIFICATION_TOPIC, fromBeginning: false });
      this.logger.info(`📡 Subscribed to Kafka topic: ${NOTIFICATION_TOPIC}`);

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          await this._processMessage(message);
        },
      });
    } catch (error) {
      this.logger.error({ err: error }, '❌ Failed to start Kafka consumer');
      // Don't throw - allow Redis to continue working
    }
  }

  /**
   * Process a single notification message
   */
  async _processMessage(message) {
    let notification;

    try {
      notification = JSON.parse(message.value.toString());
    } catch (parseError) {
      this.logger.error({ err: parseError }, '❌ Failed to parse Kafka message');
      return;
    }

    const { id, type, channel, payload, retryCount = 0 } = notification;

    // Check if this message is for telegram service
    if (channel !== 'both' && channel !== 'telegram') {
      return; // Not for us
    }

    this.logger.info({ id, type, channel }, '📥 [Kafka] Processing notification');

    try {
      await this._handleNotification(type, payload);
      this.logger.info({ id, type }, '✅ [Kafka] Notification processed');

      if (this.metricsHandlers.kafkaProcessed) {
        this.metricsHandlers.kafkaProcessed.inc({ type, status: 'success' });
      }
    } catch (error) {
      this.logger.error({ err: error, id, type }, '❌ [Kafka] Failed to process notification');

      if (retryCount < MAX_RETRIES) {
        await this._retryMessage(notification, error);
      } else {
        await this._sendToDLQ(notification, error);
      }
    }
  }

  /**
   * Handle notification by type - broadcast to all subscribers
   */
  async _handleNotification(type, payload) {
    let messageText;

    switch (type) {
      case 'signal':
        messageText = this._formatSignal(payload);
        break;

      case 'backfill':
        messageText = this._formatBackfill(payload);
        break;

      case 'system_down':
        messageText = this._formatSystemDown(payload);
        break;

      case 'system_up':
        messageText = this._formatSystemUp(payload);
        break;

      case 'alert':
        messageText = `🚨 *System Alert*\n\n${payload.message || JSON.stringify(payload)}`;
        break;

      default:
        this.logger.debug({ type }, 'Unknown notification type for Telegram');
        return;
    }

    if (messageText) {
      await this._broadcastToSubscribers(messageText);
    }
  }

  _formatSignal(data) {
    const signal = data.signal || 'UNKNOWN';
    const emoji = signal === 'BUY' ? '🟢' : signal === 'SELL' ? '🔴' : '⚪';
    return (
      `${emoji} *${signal} Signal*\n\n` +
      `📊 Symbol: \`${data.symbol}\`\n` +
      `💰 Price: ₹${data.price || 'N/A'}\n` +
      `📈 Confidence: ${data.confidence || 'N/A'}%\n` +
      `⏰ Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );
  }

  _formatBackfill(data) {
    return (
      `📥 *Backfill Complete*\n\n` +
      `Symbol: \`${data.symbol}\`\n` +
      `Records: ${data.count || 'N/A'}\n` +
      `Status: ✅ Completed`
    );
  }

  _formatSystemDown(data) {
    return (
      `🚨 *SYSTEM ALERT*\n\n` +
      `⚠️ Service Down: ${data.service || 'Unknown'}\n` +
      `Error: ${data.error || 'Connection lost'}\n` +
      `Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );
  }

  _formatSystemUp(data) {
    return (
      `✅ *System Recovered*\n\n` +
      `Service: ${data.service || 'Trading System'}\n` +
      `Downtime: ${data.downtime || 'Unknown'}\n` +
      `Status: 🟢 ONLINE`
    );
  }

  /**
   * Broadcast message to all Telegram subscribers
   */
  async _broadcastToSubscribers(message) {
    try {
      const subscribers = await this.publisher.sMembers('telegram:subscribers');

      if (!subscribers || subscribers.length === 0) {
        this.logger.warn('No subscribers to broadcast to');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const chatId of subscribers) {
        try {
          await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
          successCount++;
        } catch (err) {
          this.logger.warn({ chatId, err: err.message }, 'Failed to send message to subscriber');
          failCount++;
        }
      }

      this.logger.info(
        { successCount, failCount, total: subscribers.length },
        '📤 Kafka broadcast completed'
      );

      // Update metrics if available
      if (this.metricsHandlers.broadcastsSent) {
        this.metricsHandlers.broadcastsSent.inc({ trigger: 'kafka' });
      }
      if (this.metricsHandlers.messagesSent) {
        this.metricsHandlers.messagesSent.inc(
          { type: 'broadcast', status: 'success' },
          successCount
        );
        this.metricsHandlers.messagesSent.inc({ type: 'broadcast', status: 'failed' }, failCount);
      }
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to get subscribers for broadcast');
      throw error;
    }
  }

  /**
   * Retry a failed message
   */
  async _retryMessage(notification, error) {
    notification.retryCount = (notification.retryCount || 0) + 1;
    notification.lastError = error.message;

    try {
      await this.producer.send({
        topic: NOTIFICATION_TOPIC,
        messages: [
          {
            key: notification.id,
            value: JSON.stringify(notification),
          },
        ],
      });
      this.logger.warn(
        { id: notification.id, retryCount: notification.retryCount },
        '🔄 Message re-queued for retry'
      );

      if (this.metricsHandlers.kafkaProcessed) {
        this.metricsHandlers.kafkaProcessed.inc({ type: notification.type, status: 'retried' });
      }
    } catch (retryError) {
      this.logger.error({ err: retryError }, '❌ Failed to re-queue message');
      await this._sendToDLQ(notification, error);
    }
  }

  /**
   * Send failed message to Dead Letter Queue
   */
  async _sendToDLQ(notification, error) {
    const dlqMessage = {
      ...notification,
      dlqTimestamp: new Date().toISOString(),
      error: error.message,
      failedConsumer: 'telegram-bot',
    };

    try {
      await this.producer.send({
        topic: DLQ_TOPIC,
        messages: [
          {
            key: notification.id || 'unknown',
            value: JSON.stringify(dlqMessage),
          },
        ],
      });
      this.logger.warn({ id: notification.id, error: error.message }, '⚠️ Message sent to DLQ');

      if (this.metricsHandlers.kafkaProcessed) {
        this.metricsHandlers.kafkaProcessed.inc({ type: notification.type, status: 'dlq' }); // "Lost" / DLQ
      }
    } catch (dlqError) {
      this.logger.error({ err: dlqError }, '❌ Failed to send message to DLQ');
    }
  }

  /**
   * Stop the consumer gracefully
   */
  async stop() {
    if (!this.connected) return;

    await this.consumer.disconnect();
    await this.producer.disconnect();
    this.connected = false;
    this.logger.info('🛑 Kafka TelegramConsumer disconnected');
  }
}

module.exports = { TelegramKafkaConsumer };
