const { Kafka, logLevel } = require('kafkajs');
const config = require('../config');
const logger = require('./logger');

class KafkaClient {
  constructor() {
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      logLevel: logLevel ? logLevel.ERROR : 1, // Fallback to 1 (ERROR) if undefined
      retry: {
        initialRetryTime: 300,
        retries: 10, // Aggressive retry for startup
      },
    });

    this.consumer = this.kafka.consumer({ groupId: config.kafka.groupId });
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    logger.info({ brokers: config.kafka.brokers }, '🔌 Connecting to Kafka...');

    try {
      await this.consumer.connect();
      logger.info('✅ Kafka Consumer Connected');

      await this.consumer.subscribe({ topic: config.kafka.topic, fromBeginning: false });
      logger.info({ topic: config.kafka.topic }, '📡 Subscribed to Kafka topic');

      this.isConnected = true;
    } catch (err) {
      logger.error({ err }, '❌ Failed to connect to Kafka');
      throw err;
    }
  }

  async startConsumer(messageHandler) {
    if (!this.isConnected) await this.connect();

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value.toString();
          logger.debug({ topic, partition, offset: message.offset }, '📩 Kafka Message Received');
          await messageHandler(value);
        } catch (err) {
          logger.error({ err, topic, partition }, '❌ Error processing Kafka message');
        }
      },
    });
  }

  async disconnect() {
    if (!this.isConnected) return;
    logger.info('🛑 Disconnecting Kafka...');
    await this.consumer.disconnect();
    this.isConnected = false;
  }
}

// Export singleton
module.exports = new KafkaClient();
