const express = require('express');
const promClient = require('prom-client');
const redis = require('./redis/client');
const engine = require('./engine/decisionEngine');
const { RegimeEngine } = require('./regime/engine');
const { StrategyOrchestrator } = require('./strategies/orchestrator');
const logger = require('./utils/logger');
const { waitForAll } = require('/app/shared/health-check');
let REDIS_CHANNELS;
try { REDIS_CHANNELS = require('/app/shared/constants').REDIS_CHANNELS; } catch (_) {
  try { REDIS_CHANNELS = require('../../../shared/constants').REDIS_CHANNELS; } catch (_) {}
}

const app = express();
const PORT = process.env.PORT || 8082;

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

const regimeChanges = new promClient.Counter({
  name: 'signal_layer_regime_changes_total',
  help: 'Total number of regime changes detected',
  labelNames: ['trend', 'symbol'],
});

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5],
});

app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

let regimeEngine;
let strategyOrchestrator;

async function start() {
  try {
    logger.info('Starting Layer 6 (Signal + Regime Engine + Strategy Framework)...');

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const timescaleUrl = process.env.TIMESCALE_URL;
    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

    await waitForAll({
      redis: { url: redisUrl },
    }, { logger });

    await redis.connect();

    // Subscribe to L4 Analysis Updates (legacy per-stock signal path)
    await redis.subscribe('analysis:updates', (data) => {
      handleAnalysisUpdate(data);
    });

    await redis.subscribe('market_view', (data) => {
      engine.updateMarketView(data);
    });

    // Phase B: Start Regime Engine
    if (timescaleUrl) {
      regimeEngine = new RegimeEngine({
        redis,
        timescaleUrl,
        kafkaBrokers,
        pollIntervalMs: parseInt(process.env.REGIME_POLL_INTERVAL_MS || '60000', 10),
        symbol: process.env.REGIME_SYMBOL || 'NIFTY',
      });
      await regimeEngine.start();

      setInterval(() => {
        const state = regimeEngine.getState();
        if (state) regimeChanges.inc({ trend: state.trend, symbol: state.symbol });
      }, 60000);
    } else {
      logger.warn('No TIMESCALE_URL — Regime Engine disabled');
    }

    // Phase C: Start Strategy Framework
    if (timescaleUrl && regimeEngine) {
      strategyOrchestrator = new StrategyOrchestrator({
        redis,
        regimeEngine,
        timescaleUrl,
        kafkaBrokers,
        symbol: process.env.REGIME_SYMBOL || 'NIFTY',
      });
      await strategyOrchestrator.start();
      logger.info('Strategy framework started');
    } else {
      logger.warn('No TIMESCALE_URL — Strategy Framework disabled');
    }

    // HTTP endpoints
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', promClient.register.contentType);
      res.end(await promClient.register.metrics());
    });

    app.get('/health', (req, res) => {
      res.json({
        status: 'UP',
        redis: redis.isConnected,
        regime: !!regimeEngine?.getState(),
        strategies: strategyOrchestrator ? strategyOrchestrator.getState().registry.strategies.length : 0,
      });
    });

    app.get('/regime', (req, res) => {
      res.json(regimeEngine?.getState() || { status: 'not_available' });
    });

    app.get('/strategies', (req, res) => {
      res.json(strategyOrchestrator?.getState() || { status: 'not_available' });
    });

    try {
      await redis.publisher.del('system:layer6:metrics');
    } catch (e) { /* ignore */ }

    // Metrics Loop
    setInterval(async () => {
      try {
        const mem = process.memoryUsage();
        const regimeState = regimeEngine?.getState();
        const stratState = strategyOrchestrator?.getState();

        await redis.set('system:layer6:metrics', {
          signals_total: ((await promClient.register.getSingleMetricAsString('signal_layer_signals_generated_total')) || '0').split(' ').pop() || 0,
          regime_trend: regimeState?.trend || 'NONE',
          regime_tiers: regimeState?.tradeableTiers?.join(',') || '',
          active_strategies: stratState?.registry?.strategies?.filter(s => s.enabled)?.length || 0,
          heap_used: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
          uptime: process.uptime().toFixed(0) + 's',
          timestamp: Date.now(),
        }, { EX: 60 }); // 1 min TTL — metrics refresh every 5s
      } catch (e) {
        logger.error({ err: e }, 'Metric Publish Error');
      }
    }, 5000);

    app.listen(PORT, () => {
      logger.info(`Layer 6 listening on port ${PORT}`);
    });
  } catch (err) {
    logger.fatal({ err }, 'Fatal Error:');
    process.exit(1);
  }
}

async function handleAnalysisUpdate(analysis) {
  try {
    const signal = engine.evaluate(analysis);
    if (!signal) return;

    logger.info({ signal }, `Signal: ${signal.action} ${signal.symbol} @ ${signal.price} (Conf: ${signal.confidence})`);

    const regimeState = regimeEngine?.getState();
    if (regimeState) {
      signal.regime = regimeState.trend;
      signal.regimeConfidence = regimeState.confidence;
      signal.tradeableTiers = regimeState.tradeableTiers;
    }

    await redis.publish(REDIS_CHANNELS?.SIGNALS || 'signals:trade', signal);
    await redis.pushToList('signals:history', signal);

    signalsGenerated.inc({ action: signal.action, strategy: signal.strategy, symbol: signal.symbol });
    signalConfidence.set({ symbol: signal.symbol }, signal.confidence);
  } catch (err) {
    logger.error({ err }, 'Error processing analysis');
  }
}

async function shutdown() {
  logger.info('Shutting down Layer 6...');
  try {
    if (strategyOrchestrator) await strategyOrchestrator.stop();
    if (regimeEngine) await regimeEngine.stop();
    await redis.disconnect();
  } catch (err) {
    logger.error({ err }, 'Shutdown error');
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
