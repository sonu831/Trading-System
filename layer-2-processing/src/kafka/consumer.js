const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

// Import shared health-check library
const { waitForKafka } = require('/app/shared/health-check');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
// GROUP_ID is crucial for ensuring we don't re-process old messages if the service restarts.
// We incremented this to 'v3' after the Kafka Cluster Reset to ensure a clean slate.
const GROUP_ID = 'layer-2-processing-group-v3'; 
const TOPIC = process.env.KAFKA_TOPIC || 'raw-ticks'; // Aligned with Layer 1 ingestion producer

const kafka = new Kafka({
  clientId: 'layer-2-processing',
  brokers: KAFKA_BROKERS,
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 500,
    retries: 15,
    maxRetryTime: 30000, // Aggressive retry policy for resiliency
  },
});

const consumer = kafka.consumer({
  groupId: GROUP_ID,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
});

/**
 * Start consuming messages from Kafka
 * @param {Function} messageHandler - Callback function to process each message
 */
async function startConsumer(messageHandler) {
  try {
    // Wait for Kafka to be fully ready before connecting consumer (using shared library)
    await waitForKafka({
      brokers: KAFKA_BROKERS,
      topic: TOPIC,
    });

    await consumer.connect();
    logger.info(`Kafka Consumer connected to: ${KAFKA_BROKERS.join(', ')}`);

    // fromBeginning: true -> Consume all available messages from the beginning of the topic.
    // This ensures no messages are missed, even if the service was down.
    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
    logger.info(`Subscribed to topic: ${TOPIC}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value.toString();
          logger.debug({ topic, preview: value.substring(0, 100) }, 'Received message');
          const data = JSON.parse(value);

          // Delegate to the business logic handler
          // Note: Deduplication should happen in the handler or DB layer (idempotency)
          await messageHandler(data);
        } catch (err) {
          logger.error({ err }, 'Error processing message');
        }
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start Kafka consumer');
    throw err;
  }
}

async function stopConsumer() {
  await consumer.disconnect();
  logger.info('Kafka Consumer disconnected');
}

module.exports = {
  startConsumer,
  stopConsumer,
};
