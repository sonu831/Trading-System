/**
 * Kafka Notification Consumer for Email Service
 *
 * Consumes notification messages from Kafka and triggers email sending.
 * Runs alongside Redis Pub/Sub for dual-mode operation during migration.
 */

const { Kafka, logLevel } = require('kafkajs');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',');
const NOTIFICATION_TOPIC = process.env.KAFKA_NOTIFICATION_TOPIC || 'notifications';
const DLQ_TOPIC = process.env.KAFKA_NOTIFICATION_DLQ_TOPIC || 'notifications-dlq';
const KAFKA_ENABLED = process.env.KAFKA_ENABLED !== 'false';
const MAX_RETRIES = 3;

class EmailKafkaConsumer {
  constructor(options) {
    this.logger = options.logger || console;
    this.sendEmailFn = options.sendEmail;
    this.metricsHandlers = options.metrics || {};
    this.connected = false;

    if (!KAFKA_ENABLED) {
      this.logger.info('📭 Kafka consumer is disabled (KAFKA_ENABLED=false)');
      return;
    }

    this.kafka = new Kafka({
      clientId: 'email-service-consumer',
      brokers: KAFKA_BROKERS,
      logLevel: logLevel.WARN,
      retry: {
        initialRetryTime: 300,
        retries: 10,
      },
    });

    this.consumer = this.kafka.consumer({
      groupId: 'email-notification-consumer',
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
      this.logger.info(`✅ Kafka EmailConsumer connected to: ${KAFKA_BROKERS.join(', ')}`);

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

    // Check if this message is for email service
    if (channel !== 'both' && channel !== 'email') {
      return; // Not for us
    }

    this.logger.info({ id, type, channel }, '📥 [Kafka] Processing notification');

    // Increment metrics
    if (this.metricsHandlers.notificationsReceived) {
      this.metricsHandlers.notificationsReceived.inc({ channel: `kafka_${type}` });
    }

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
   * Handle notification by type
   */
  async _handleNotification(type, payload) {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    switch (type) {
      case 'suggestion':
        await this._handleSuggestion(payload);
        break;

      case 'backfill':
        await this._handleBackfill(payload);
        break;

      case 'alert':
        await this._handleAlert(payload);
        break;

      case 'bot_restart':
        await this._handleBotRestart(payload, timestamp);
        break;

      case 'system_down':
        await this._handleSystemDown(payload, timestamp);
        break;

      case 'system_up':
        await this._handleSystemUp(payload, timestamp);
        break;

      default:
        this.logger.warn({ type }, 'Unknown notification type');
    }
  }

  async _handleSuggestion(data) {
    const subject = `💡 New Suggestion from ${data.user}`;
    const body = `User: ${data.user}\nMessage: ${data.text}\nSource: ${data.source}`;
    const html = `
      <h3>💡 New User Suggestion</h3>
      <p><strong>User:</strong> ${data.user}</p>
      <p><strong>Message:</strong> ${data.text}</p>
      <p><em>Source: ${data.source}</em></p>
    `;
    await this.sendEmailFn(subject, body, html, 'suggestion');
  }

  async _handleBackfill(data) {
    const subject = `📥 Backfill Complete: ${data.symbol}`;
    const body = JSON.stringify(data, null, 2);
    await this.sendEmailFn(subject, body, `<pre>${body}</pre>`, 'backfill');
  }

  async _handleAlert(data) {
    await this.sendEmailFn('🚨 System Alert', data.message || JSON.stringify(data), null, 'alert');
  }

  async _handleBotRestart(data, timestamp) {
    const subject = `🔄 Bot Restarted - ${data.botName || 'Trading System'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 8px;">
          <h2 style="color: #667eea; margin-bottom: 20px;">🔄 Bot Restarted Successfully!</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Bot Name:</strong></td>
              <td style="padding: 12px 0;">${data.botName || 'Guru Ji Trading Bot'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Instance ID:</strong></td>
              <td style="padding: 12px 0; font-family: monospace;">${data.instanceId || 'N/A'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Hostname:</strong></td>
              <td style="padding: 12px 0;">${data.hostname || 'Unknown'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Restart Time:</strong></td>
              <td style="padding: 12px 0;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666;"><strong>Status:</strong></td>
              <td style="padding: 12px 0;"><span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 4px;">🟢 ONLINE</span></td>
            </tr>
          </table>
          <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 6px; text-align: center;">
            <p style="margin: 0; color: #666;">🙏 <em>Thank you for using Guru Ji Trading System!</em></p>
          </div>
        </div>
      </div>
    `;
    const text = `Bot Restarted: ${data.botName || 'Trading Bot'}\nTime: ${timestamp}\nInstance: ${data.instanceId}\nStatus: ONLINE`;
    await this.sendEmailFn(subject, text, html, 'bot_restart');
  }

  async _handleSystemDown(data, timestamp) {
    const subject = `🚨 CRITICAL: System Down - ${data.service || 'Trading System'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 8px;">
          <h2 style="color: #dc3545; margin-bottom: 20px;">🚨 System Down Alert!</h2>
          <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
            <strong>⚠️ Immediate attention required!</strong>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Service:</strong></td>
              <td style="padding: 12px 0;">${data.service || 'Unknown Service'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Error:</strong></td>
              <td style="padding: 12px 0; color: #dc3545;">${data.error || 'Connection Lost'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Time Detected:</strong></td>
              <td style="padding: 12px 0;">${timestamp}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666;"><strong>Status:</strong></td>
              <td style="padding: 12px 0;"><span style="background: #dc3545; color: white; padding: 4px 12px; border-radius: 4px;">🔴 DOWN</span></td>
            </tr>
          </table>
        </div>
      </div>
    `;
    const text = `CRITICAL: System Down\nService: ${data.service}\nError: ${data.error}\nTime: ${timestamp}`;
    await this.sendEmailFn(subject, text, html, 'system_down');
  }

  async _handleSystemUp(data, timestamp) {
    const downtime = data.downtime || 'Unknown';
    const subject = `✅ System Recovered - ${data.service || 'Trading System'}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 10px;">
        <div style="background: white; padding: 30px; border-radius: 8px;">
          <h2 style="color: #28a745; margin-bottom: 20px;">✅ System Recovered!</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Service:</strong></td>
              <td style="padding: 12px 0;">${data.service || 'Trading System'}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Recovery Time:</strong></td>
              <td style="padding: 12px 0;">${timestamp}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 0; color: #666;"><strong>Total Downtime:</strong></td>
              <td style="padding: 12px 0;">${downtime}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; color: #666;"><strong>Status:</strong></td>
              <td style="padding: 12px 0;"><span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 4px;">🟢 ONLINE</span></td>
            </tr>
          </table>
          <div style="margin-top: 25px; padding: 15px; background: #d4edda; border: 1px solid #28a745; border-radius: 6px; text-align: center;">
            <p style="margin: 0; color: #155724;"><strong>🎉 All systems are back online!</strong></p>
          </div>
        </div>
      </div>
    `;
    const text = `System Recovered: ${data.service}\nRecovery Time: ${timestamp}\nDowntime: ${downtime}\nStatus: ONLINE`;
    await this.sendEmailFn(subject, text, html, 'system_up');
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
      failedConsumer: 'email-service',
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
    this.logger.info('🛑 Kafka EmailConsumer disconnected');
  }
}

module.exports = { EmailKafkaConsumer };
