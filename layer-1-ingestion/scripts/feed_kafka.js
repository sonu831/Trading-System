const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',')
  : ['localhost:9092'];
const TOPIC = 'market_data_feed';
const DATA_DIR = path.resolve(__dirname, '../data/historical');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = require('redis');
let redisClient = null;

const kafka = new Kafka({
  clientId: 'layer-1-history-feeder',
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 100,
    retries: 2,
  },
});

const producer = kafka.producer();

async function main() {
  console.log('🚀 Starting Historical Data Feeder...');
  console.log(`🔌 Kafka Brokers: ${KAFKA_BROKERS.join(',')}`);
  console.log(`📂 Data Dir: ${DATA_DIR}`);

  try {
    await producer.connect();
    console.log('✅ Connected to Kafka');

    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    console.log(`Found ${files.length} data files.`);

    // Initialize Redis
    try {
      redisClient = redis.createClient({ url: REDIS_URL });
      await redisClient.connect();
    } catch (e) {
      console.warn('⚠️ Redis not available');
    }

    const updateStatus = async (progress, details) => {
      if (redisClient) {
        const statusObj = {
          status: 1, // 1: Running
          progress: Math.round(progress),
          details: details,
          job_type: 'historical_backfill',
          timestamp: Date.now(),
        };
        await redisClient.set('system:layer1:backfill', JSON.stringify(statusObj));
      }
    };

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const rawData = fs.readFileSync(filePath, 'utf-8');
      const jsonData = JSON.parse(rawData);

      const symbol = jsonData.symbol;
      const candles = jsonData.candles; // [[time, o, h, l, c, v], ...]

      console.log(`📤 Feeding ${symbol} (${candles.length} candles) to topic '${TOPIC}'...`);

      const currentIdx = files.indexOf(file);
      const stepProgress = 50 + (currentIdx / files.length) * 50;
      await updateStatus(
        stepProgress,
        `Feeding ${symbol} to Kafka (${currentIdx + 1}/${files.length})`
      );

      // Transform candles to standard object if needed
      // Currently sending raw candle array wrapped in standardized event
      const messages = candles.map((candle) => ({
        key: symbol,
        value: JSON.stringify({
          type: 'historical_candle',
          symbol: symbol,
          interval: jsonData.interval || 'ONE_MINUTE',
          timestamp: candle[0], // Assuming MStock format index 0 is time
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5],
          source: 'mstock-batch',
        }),
      }));

      // Send in batches of 100 to avoid message size limits
      const BATCH_SIZE = 100;
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        await producer.send({
          topic: TOPIC,
          messages: batch,
        });
      }
      console.log(`   ✅ Sent ${messages.length} events for ${symbol}`);
    }

    console.log('\n🏁 Feed Complete.');
  } catch (e) {
    console.error('❌ Feed Error:', e);
  } finally {
    await producer.disconnect();
    if (redisClient) {
      await redisClient.quit();
    }
  }
}

main();
