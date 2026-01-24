/**
 * Kafka Notifications Module
 *
 * Provides durable notification messaging for the Trading System.
 *
 * Usage:
 *
 * Producer (publish notifications):
 * ```js
 * const { getNotificationProducer } = require('@trading-system/kafka-notifications');
 *
 * const producer = getNotificationProducer();
 * await producer.connect();
 * await producer.send({
 *   type: 'bot_restart',
 *   channel: 'both', // telegram, email, or both
 *   payload: { botName: 'Guru Ji', instanceId: '123' }
 * });
 * ```
 *
 * Consumer (receive notifications):
 * ```js
 * const { NotificationConsumer } = require('@trading-system/kafka-notifications');
 *
 * const consumer = new NotificationConsumer({
 *   groupId: 'telegram-notification-consumer',
 *   consumerName: 'telegram-bot',
 *   targetChannel: 'telegram',
 * });
 *
 * consumer.on('bot_restart', async (payload) => {
 *   // Handle bot restart notification
 * });
 *
 * await consumer.start();
 * ```
 */

const {
  NotificationProducer,
  getNotificationProducer,
  NOTIFICATION_TOPIC,
  DLQ_TOPIC,
} = require('./notification-producer');
const { NotificationConsumer } = require('./notification-consumer');

module.exports = {
  // Producer
  NotificationProducer,
  getNotificationProducer,

  // Consumer
  NotificationConsumer,

  // Constants
  NOTIFICATION_TOPIC,
  DLQ_TOPIC,
};
