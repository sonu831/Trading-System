const { Kafka } = require('kafkajs');
const logger = require('../utils/logger');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const GROUP_ID = 'layer-2-option-chain-group-v1';
const TOPIC = process.env.KAFKA_TOPIC_OPTION_CHAIN || require('/app/shared/constants').KAFKA_TOPICS.OPTION_CHAIN;

const kafka = new Kafka({
  clientId: 'layer-2-option-chain',
  brokers: KAFKA_BROKERS,
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: { initialRetryTime: 500, retries: 15, maxRetryTime: 30000 },
});

const consumer = kafka.consumer({
  groupId: GROUP_ID,
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
});

let optionChainWriter = null;

async function startOptionChainConsumer(writer) {
  optionChainWriter = writer;

  try {
    await consumer.connect();
    logger.info(`OptionChain Consumer connected to: ${KAFKA_BROKERS.join(', ')}`);

    await consumer.subscribe({ topic: TOPIC, fromBeginning: false });
    logger.info(`OptionChain Consumer subscribed to: ${TOPIC}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value.toString();
          const snapshot = JSON.parse(value);
          await optionChainWriter.processSnapshot(snapshot);
        } catch (err) {
          logger.error({ err }, 'OptionChain Consumer: Error processing message');
        }
      },
    });

    logger.info('OptionChain Consumer: Running');
  } catch (err) {
    logger.error({ err }, 'OptionChain Consumer: Failed to start');
    throw err;
  }
}

async function stopOptionChainConsumer() {
  await consumer.disconnect();
  logger.info('OptionChain Consumer: Disconnected');
}

module.exports = { startOptionChainConsumer, stopOptionChainConsumer };
