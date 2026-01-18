const { Kafka } = require('kafkajs');

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
const GROUP_ID = 'layer-2-processing-group';
const TOPIC = process.env.KAFKA_TOPIC || 'market_data_feed';

const kafka = new Kafka({
  clientId: 'layer-2-processing',
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 300,
    retries: 10,
  },
});

const consumer = kafka.consumer({ groupId: GROUP_ID });

/**
 * Start consuming messages from Kafka
 * @param {Function} messageHandler - Callback function to process each message
 */
async function startConsumer(messageHandler) {
  try {
    await consumer.connect();
    console.log(`✅ Kafka Consumer connected to: ${KAFKA_BROKERS.join(', ')}`);

    await consumer.subscribe({ topic: TOPIC, fromBeginning: true });
    console.log(`📡 Subscribed to topic: ${TOPIC}`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const value = message.value.toString();
          const data = JSON.parse(value);

          await messageHandler(data);
        } catch (err) {
          console.error(`❌ Error processing message: ${err.message}`);
        }
      },
    });
  } catch (err) {
    console.error('❌ Failed to start Kafka consumer:', err.message);
    throw err;
  }
}

async function stopConsumer() {
  await consumer.disconnect();
  console.log('🛑 Kafka Consumer disconnected.');
}

module.exports = {
  startConsumer,
  stopConsumer,
};
