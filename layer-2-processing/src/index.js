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
const logger = require('./utils/logger'); // Import Logger

const { connectDB, pool } = require('./db/client');
const { startConsumer, stopConsumer } = require('./kafka/consumer');
const { insertCandle } = require('./services/candleWriter');
const {
  connectRedis,
  setLatestPrice,
  setLatestCandle,
  disconnectRedis,
  setMetrics,
} = require('./services/redisCache');

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

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

// Middleware for HTTP request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

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
      logger.warn({ type: message.type }, '⚠️ Unknown message type');
    }
  } catch (err) {
    logger.error({ err }, '❌ Failed to process message');
  } finally {
    end();
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('🚀 Starting Layer 2: Processing Service...');

  // 1. Start Express Server FIRST (so Prometheus can always scrape)
  app.listen(PORT, () => {
    logger.info(`📡 Health/Metrics server running on port ${PORT}`);
  });

  try {
    // 2. Connect to Database
    await connectDB();

    // 3. Connect to Redis
    await connectRedis();

    // 4. Start Kafka Consumer
    await startConsumer(handleMessage);

    // 5. Start Metrics Loop
    setInterval(async () => {
      const mem = process.memoryUsage();
      await setMetrics({
        candles_processed:
          parseInt(
            ((await client.register.getSingleMetricAsString('candles_processed_total')) || '0')
              .split(' ')
              .pop()
          ) || 0,
        heap_used: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
        timestamp: Date.now(),
      });
    }, 5000);

    logger.info('✅ Layer 2 Processing Service is running.');
  } catch (err) {
    logger.error({ err }, '❌ Failed to start Layer 2');
    // Don't exit - keep the container running so Prometheus can scrape it
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down gracefully...');
  await stopConsumer();
  await disconnectRedis();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service
main();
