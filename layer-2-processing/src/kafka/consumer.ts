const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

// Import shared health-check library
const { waitForKafka } = require('/app/shared/health-check');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
// GROUP_ID is crucial for ensuring we don't re-process old messages if the service restarts.
// We incremented this to 'v3' after the Kafka Cluster Reset to ensure a clean slate.
const GROUP_ID = 'layer-2-processing-group-v4'; // Versioned — bump on breaking schema changes
const TOPIC = process.env.KAFKA_TOPIC || 'raw-ticks';

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

    // fromBeginning: false -> Only consume NEW messages when the service starts.
    // This assumes historical data is backfilled separately or handled by offset commits.
    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
    logger.info(`Subscribed to topic: ${TOPIC}`);

    await consumer.run({
      autoCommit: false, // Manual commit AFTER successful processing — prevents data loss on crash
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value.toString();
          const data = JSON.parse(value);
          await messageHandler(data);
          // Commit offset only after successful processing
          await consumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }]);
        } catch (err) {
          logger.error({ err, offset: message.offset }, 'Error processing message — offset NOT committed, will retry');
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
