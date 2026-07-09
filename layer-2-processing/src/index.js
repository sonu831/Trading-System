require('dotenv').config();
const express = require('express');
const client = require('prom-client');
const logger = require('./utils/logger');

const { waitForAll, initHealthMetrics } = require('/app/shared/health-check');

const { connectDB, pool } = require('./db/client');
const { startConsumer, stopConsumer } = require('./kafka/consumer');
const { startOptionChainConsumer, stopOptionChainConsumer } = require('./kafka/optionChainConsumer');
const { OptionChainWriter } = require('./services/optionChainWriter');
const { insertCandle } = require('./services/candleWriter');
const { CandleAggregator } = require('./services/candleAggregator');
const {
  connectRedis,
  setLatestPrice,
  setLatestCandle,
  disconnectRedis,
  setMetrics,
} = require('./services/redisCache');

const app = express();
const PORT = process.env.PORT || 3002;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const candlesProcessedCounter = new client.Counter({
  name: 'candles_processed_total',
  help: 'Total number of candles processed',
  labelNames: ['symbol'],
});
register.registerMetric(candlesProcessedCounter);

const ticksReceivedCounter = new client.Counter({
  name: 'ticks_received_total',
  help: 'Total number of ticks received',
  labelNames: ['symbol'],
});
register.registerMetric(ticksReceivedCounter);

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

app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'layer-2-processing',
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

let candleAggregator;

/**
 * Global writer instance for option chain
 */
let optionChainWriter;

/**
 * Handle incoming Kafka message
 */
async function handleMessage(message) {
  const end = processingLatencyHistogram.startTimer();

  try {
    if (message.type === 'historical_candle') {
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

      await insertCandle(candle);
      await setLatestPrice(message.symbol, {
        price: message.close,
        time: message.timestamp,
        volume: message.volume,
      });
      await setLatestCandle(message.symbol, '1m', candle);
      candlesProcessedCounter.inc({ symbol: message.symbol });
    } else if (message.type === 'live_tick' && candleAggregator) {
      ticksReceivedCounter.inc({ symbol: message.symbol });
      candleAggregator.processTick(message);
    } else if (message.type === undefined && candleAggregator) {
      // Raw tick from ingestion (no type field) — treat as live_tick
      ticksReceivedCounter.inc({ symbol: message.symbol });
      candleAggregator.processTick({
        type: 'live_tick',
        symbol: message.symbol,
        exchange: message.exchange || 'NSE',
        timestamp: message.timestamp || Date.now(),
        ltp: message.ltp,
        volume: message.volume || 0,
      });
    } else {
      logger.warn({ type: message.type }, 'Unknown message type');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to process message');
  } finally {
    end();
  }
}

async function onCandleComplete(candle) {
  try {
    await insertCandle(candle);
    await setLatestPrice(candle.symbol, {
      price: candle.close,
      time: candle.time,
      volume: candle.volume,
    });
    await setLatestCandle(candle.symbol, '1m', {
      symbol: candle.symbol,
      timestamp: candle.time,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
    });
    candlesProcessedCounter.inc({ symbol: candle.symbol });
  } catch (err) {
    logger.error({ err, symbol: candle.symbol }, 'Failed to write completed candle');
  }
}

async function main() {
  logger.info('Starting Layer 2: Processing Service...');

  app.listen(PORT, () => {
    logger.info(`Health/Metrics server running on port ${PORT}`);
  });

  try {
    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    const kafkaTopic = process.env.KAFKA_TOPIC || 'raw-ticks';
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const timescaleUrl = process.env.TIMESCALE_URL || 'postgresql://user:pass@timescaledb:5432/db';

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

    await connectDB();
    await connectRedis();

    candleAggregator = new CandleAggregator({
      intervalMs: 60000,
      onCandleComplete,
    });

    await startConsumer(handleMessage);

    // Start option chain consumer
    const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
    const { createClient } = require('redis');
    const redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
    optionChainWriter = new OptionChainWriter({ pool, redisClient });
    await startOptionChainConsumer(optionChainWriter);
    logger.info('Option chain consumer started');

    setInterval(async () => {
      const mem = process.memoryUsage();
      const aggStats = candleAggregator.getStats();
      await setMetrics({
        candles_processed: aggStats.candles,
        ticks_received: aggStats.ticks,
        active_symbols: aggStats.activeSymbols,
        heap_used: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
        timestamp: Date.now(),
      });
    }, 5000);

    logger.info('Layer 2 Processing Service is running.');
  } catch (err) {
    logger.error({ err }, 'Failed to start Layer 2');
  }
}

async function shutdown() {
  logger.info('Shutting down gracefully...');
  if (candleAggregator) {
    candleAggregator.flushAll();
    candleAggregator.destroy();
  }
  await stopConsumer();
  await stopOptionChainConsumer();
  await disconnectRedis();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
