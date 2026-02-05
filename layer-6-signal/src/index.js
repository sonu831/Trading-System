const express = require('express');
const promClient = require('prom-client');
const redis = require('./redis/client');
const engine = require('./engine/decisionEngine');
const logger = require('./utils/logger');
const { waitForAll } = require('/app/shared/health-check');

const app = express();
const PORT = process.env.PORT || 8082; // Signal Layer Port

// Prometheus Metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'signal_layer_' });

const signalsGenerated = new promClient.Counter({
  name: 'signal_layer_signals_generated_total',
  help: 'Total number of trading signals generated',
  labelNames: ['action', 'strategy', 'symbol'],
});

const signalConfidence = new promClient.Gauge({
  name: 'signal_layer_confidence',
  help: 'Confidence score of generated signals',
  labelNames: ['symbol'],
});

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5],
});

// Middleware for HTTP request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

async function start() {
  try {
    logger.info('🚀 Starting Layer 6 (Signal Generation)...');

    // 1. Wait for Infrastructure Dependencies
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    // const timescaleUrl = process.env.TIMESCALE_URL || 'postgresql://...';

    // Initialize health metrics if needed, or pass registry (Layer 6 uses separate registry in promClient, so we can pass it if we want standard metrics)
    // For now just wait for Redis
    await waitForAll({
      redis: {
        url: redisUrl,
      },
    }, { logger });

    // 2. Connect to Redis
    await redis.connect();

    // 2. Subscribe to Market View (Layer 5)
    // Adjust channel name if Layer 5 publishes to strict channel
    // Based on L5 code: it sets key `market_view:latest`, but we need a Pub/Sub trigger.
    // If L5 doesn't publish, we might need to poll or update L5.
    // *Correction*: L4 publishes `analysis:updates`. L5 publishes `market_view:updates` (assumed, let's verify).

    // We will assume L5 publishes to 'market:updates' or we poll.
    // For now, let's Subscribe to L4 Analysis.
    await redis.subscribe('analysis:updates', (data) => {
      handleAnalysisUpdate(data);
    });

    // Also subscribe to Market View if available, or just use KV get periodically
    await redis.subscribe('market_view', (data) => {
      engine.updateMarketView(data);
    });

    // Start HTTP Server for Metrics
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      res.end(await promClient.register.metrics());
    });

    app.get('/health', (req, res) => {
      res.json({ status: 'UP', redis: redis.isConnected });
    });

    // Auto-fix WRONGTYPE error by resetting the key (uses existing redis connection)
    try {
      await redis.publisher.del('system:layer6:metrics');
    } catch (e) {
      /* ignore */
    }

    // Start Metrics Loop
    setInterval(async () => {
      try {
        const mem = process.memoryUsage();
        // Use getListLength for lists, not get
        const count = await redis.getListLength('signals:history');
        // However, promClient has 'signalsGenerated'. I can read that.

        await redis.set('system:layer6:metrics', {
          signals_total:
            (
              (await promClient.register.getSingleMetricAsString(
                'signal_layer_signals_generated_total'
              )) || '0'
            )
              .split(' ')
              .pop() || 0,
          heap_used: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
          uptime: process.uptime().toFixed(0) + 's',
          timestamp: Date.now(),
        });
      } catch (e) {
        logger.error({ err: e }, 'Metric Publish Error');
      }
    }, 5000);

    app.listen(PORT, () => {
      logger.info(`✅ Layer 6 listening on port ${PORT}`);
    });
  } catch (err) {
    logger.fatal({ err }, '🔥 Fatal Error:');
    process.exit(1);
  }
}

async function handleAnalysisUpdate(analysis) {
  try {
    // Run Decision Engine
    const signal = engine.evaluate(analysis);

    if (signal) {
      logger.info(
        { signal },
        `🔔 SIGNAL GENERATED: ${signal.action} ${signal.symbol} @ ${signal.price} (Conf: ${signal.confidence})`
      );

      // Publish Signal to Kafka/Redis for Layer 7
      await redis.publish('signals:trade', signal);

      // Persist to History for Dashboard
      await redis.pushToList('signals:history', signal);

      // Update Metrics
      signalsGenerated.inc({
        action: signal.action,
        strategy: signal.strategy,
        symbol: signal.symbol,
      });
      signalConfidence.set({ symbol: signal.symbol }, signal.confidence);
    }
  } catch (err) {
    logger.error({ err }, 'Error processing analysis');
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down Layer 6...');
  try {
    await redis.disconnect();
  } catch (err) {
    logger.error({ err }, 'Shutdown error');
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
