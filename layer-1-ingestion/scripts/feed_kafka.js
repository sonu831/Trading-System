const { Kafka } = require('kafkajs');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

// Configuration
const KAFKA_BROKERS = process.env.KAFKA_BROKERS
  ? process.env.KAFKA_BROKERS.split(',')
  : ['localhost:9092'];
const TOPIC = process.env.KAFKA_TOPIC || 'raw-ticks';
const DATA_DIR = path.resolve(__dirname, '../data/historical');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = require('redis');
let redisClient = null;

const kafka = new Kafka({
  clientId: 'layer-1-history-feeder',
  brokers: KAFKA_BROKERS,
  connectionTimeout: 10000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 500,
    retries: 10,
    maxRetryTime: 30000,
  },
});

const producer = kafka.producer();

/**
 * Wait for Kafka to be healthy (leaders available for topics)
 */
async function waitForKafka(maxRetries = 20, delayMs = 3000) {
  const admin = kafka.admin();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await admin.connect();

      // Check if the topic exists and has leaders
      const metadata = await admin.fetchTopicMetadata({ topics: [TOPIC] });
      const topicData = metadata.topics[0];

      if (topicData && topicData.partitions) {
        // Check all partitions have leaders
        const allHaveLeaders = topicData.partitions.every(p => p.leader !== -1);
        if (allHaveLeaders) {
          console.log(`✅ Kafka is ready - topic '${TOPIC}' has ${topicData.partitions.length} partitions with leaders`);
          await admin.disconnect();
          return true;
        }
      }

      throw new Error('Topic partitions do not have leaders yet');
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`❌ Kafka not ready after ${maxRetries} attempts: ${error.message}`);
        try { await admin.disconnect(); } catch (e) {}
        throw error;
      }
      console.log(`⏳ Waiting for Kafka... (${attempt}/${maxRetries}) - ${error.message}`);
      try { await admin.disconnect(); } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

async function main() {
  console.log('🚀 Starting Historical Data Feeder...');
  console.log(`🔌 Kafka Brokers: ${KAFKA_BROKERS.join(',')}`);
  console.log(`📂 Data Dir: ${DATA_DIR}`);

  try {
    // Wait for Kafka to be fully ready (topic with leaders)
    console.log('⏳ Waiting for Kafka to be ready...');
    await waitForKafka();

    await producer.connect();
    console.log('✅ Connected to Kafka Producer');

    // Parse CLI args for symbol filter
    const args = process.argv.slice(2);
    const symbolArgIdx = args.indexOf('--symbol');
    const targetSymbol = symbolArgIdx !== -1 ? args[symbolArgIdx + 1] : null;

    let files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    
    // Filter by symbol if provided
    if (targetSymbol) {
      console.log(`🎯 Feeding ONLY symbol: ${targetSymbol}`);
      files = files.filter(f => f.toUpperCase().startsWith(targetSymbol.toUpperCase()));
    }

    console.log(`Found ${files.length} data files to feed.`);

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

        if ((i / BATCH_SIZE) % 10 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Report metric to parent process (for Prometheus/Grafana)
        if (process.send) {
          process.send({
            type: 'metric',
            name: 'kafkaMessagesSent',
            labels: { topic: TOPIC },
            value: batch.length,
          });
        }
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
