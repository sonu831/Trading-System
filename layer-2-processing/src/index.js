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

// Import shared health-check library
const { waitForAll, initHealthMetrics } = require('/app/shared/health-check');

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
      const inserted = await insertCandle(candle);

      // Track duplicate vs fresh
      const statKey = `stats:${message.symbol}`;
      if (!global.backfillStats) global.backfillStats = {};
      if (!global.backfillStats[message.symbol]) global.backfillStats[message.symbol] = { inserted: 0, ignored: 0 };
      
      if (inserted) {
        global.backfillStats[message.symbol].inserted++;
      } else {
        global.backfillStats[message.symbol].ignored++;
      }

      // Publish comprehensive stats to Redis periodically (every 1000 ticks per symbol)
      const totalProcessed = global.backfillStats[message.symbol].inserted + global.backfillStats[message.symbol].ignored;
      if (totalProcessed % 1000 === 0) {
         const { publishEvent } = require('./services/redisCache');
         
         // Comprehensive notification payload following best practices
         publishEvent('system:notifications', {
            type: 'BACKFILL_STATS',
            message: `Processed ${totalProcessed} candles for ${message.symbol}`,
            metadata: {
               // Source identification
               source: 'layer-2-processing',
               layer: 2,
               service: 'candle-processor',
               
               // Core metrics
               metrics: {
                  symbol: message.symbol,
                  inserted: global.backfillStats[message.symbol].inserted,
                  ignored: global.backfillStats[message.symbol].ignored,
                  total: totalProcessed,
                  insertionRate: (global.backfillStats[message.symbol].inserted / totalProcessed * 100).toFixed(2) + '%',
                  duplicateRate: (global.backfillStats[message.symbol].ignored / totalProcessed * 100).toFixed(2) + '%'
               },
               
               // Processing context
               context: {
                  messageType: message.type,
                  exchange: message.exchange || 'NSE',
                  latestTimestamp: message.timestamp,
                  processingMode: message.type === 'historical_candle' ? 'backfill' : 'live'
               },
               
               // Timestamp for tracking
               timestamp: Date.now(),
               timestampISO: new Date().toISOString()
            }
         });
      }

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
    
    // Publish error notification for critical failures
    try {
      const { publishEvent } = require('./services/redisCache');
      publishEvent('system:notifications', {
        type: 'ERROR',
        message: `Failed to process candle for ${message?.symbol || 'UNKNOWN'}`,
        metadata: {
          source: 'layer-2-processing',
          layer: 2,
          service: 'candle-processor',
          error: {
            message: err.message,
            stack: err.stack,
            code: err.code
          },
          context: {
            symbol: message?.symbol,
            messageType: message?.type,
            timestamp: message?.timestamp
          },
          timestamp: Date.now(),
          timestampISO: new Date().toISOString()
        }
      });
    } catch (notifErr) {
      logger.error({ err: notifErr }, 'Failed to publish error notification');
    }
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
    // 2. Wait for Infrastructure Dependencies (Shared Library)
    // ═══════════════════════════════════════════════════════════════
    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const kafkaTopic = process.env.KAFKA_TOPIC || 'raw-ticks';
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const timescaleUrl = process.env.TIMESCALE_URL || 'postgresql://user:pass@timescaledb:5432/db';

    // Initialize metrics
    initHealthMetrics(register);

    const { redis: connectedRedis, timescale: connectedPgPool } = await waitForAll({
      kafka: {
        brokers: kafkaBrokers,
        topic: kafkaTopic,
      },
      redis: {
        url: redisUrl,
      },
      timescale: {
        connectionString: timescaleUrl,
        requiredTables: ['candles_1m'],
      },
    }, { logger });

    // Use the connected clients (or reuse existing modules if they manage their own state)
    // For this service, we already have modules managing singletons, so we just let them connect now that we know infra is ready.
    // Ideally, we would inject these clients, but for minimal refactor, we let existing modules connect.

    await connectDB(); // Might reuse the pool from waitForAll if refactored, but here we just wait.
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
