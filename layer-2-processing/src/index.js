/**
 * Layer 2: Processing Service
 *
 * Consumes market data from Kafka,
 * validates and transforms it,
 * and persists to TimescaleDB.
 *
 * @author Yogendra Singh
 */

require('dotenv').config();
const express = require('express');
const client = require('prom-client');

const { connectDB, pool } = require('./db/client');
const { startConsumer, stopConsumer } = require('./kafka/consumer');
const { insertCandle } = require('./services/candle-writer');
const {
  connectRedis,
  setLatestPrice,
  setLatestCandle,
  disconnectRedis,
} = require('./services/redis-cache');

// Initialize Express for health checks & metrics
const app = express();
const PORT = process.env.PORT || 3002;

// Prometheus Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// Custom Metrics
const candlesProcessedCounter = new client.Counter({
  name: 'candles_processed_total',
  help: 'Total number of candles processed',
  labelNames: ['symbol'],
});
register.registerMetric(candlesProcessedCounter);

const processingLatencyHistogram = new client.Histogram({
  name: 'candle_processing_latency_seconds',
  help: 'Latency of processing each candle',
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});
register.registerMetric(processingLatencyHistogram);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'layer-2-processing',
    timestamp: new Date().toISOString(),
  });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

/**
 * Handle incoming Kafka message
 * @param {Object} message - Parsed JSON message from Kafka
 */
async function handleMessage(message) {
  const end = processingLatencyHistogram.startTimer();

  try {
    // Expected message format from Layer 1:
    // { type: 'historical_candle', symbol: 'RELIANCE', timestamp: '...', open, high, low, close, volume }

    if (message.type === 'historical_candle' || message.type === 'live_tick') {
      const candle = {
        symbol: message.symbol,
        timestamp: message.timestamp,
        exchange: message.exchange || 'NSE',
        open: message.open,
        high: message.high,
        low: message.low,
        close: message.close,
        volume: message.volume,
      };

      // 1. Persist to TimescaleDB
      await insertCandle(candle);

      // 2. Update Redis Hot Cache (LTP & Latest Candle)
      await setLatestPrice(message.symbol, {
        price: message.close,
        time: message.timestamp,
        volume: message.volume,
      });

      await setLatestCandle(message.symbol, '1m', candle);

      candlesProcessedCounter.inc({ symbol: message.symbol });
    } else {
      console.warn(`⚠️ Unknown message type: ${message.type}`);
    }
  } catch (err) {
    console.error(`❌ Failed to process message: ${err.message}`);
  } finally {
    end();
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Starting Layer 2: Processing Service...');

  try {
    // 1. Connect to Database
    await connectDB();

    // 2. Connect to Redis
    await connectRedis();

    // 3. Start Kafka Consumer
    await startConsumer(handleMessage);

    // 4. Start Express Server
    app.listen(PORT, () => {
      console.log(`📡 Health/Metrics server running on port ${PORT}`);
    });

    console.log('✅ Layer 2 Processing Service is running.');
  } catch (err) {
    console.error('❌ Failed to start Layer 2:', err.message);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('🛑 Shutting down gracefully...');
  await stopConsumer();
  await disconnectRedis();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service
main();
