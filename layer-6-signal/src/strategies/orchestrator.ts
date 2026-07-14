const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { StrategyRegistry } = require('./registry');
const { StrategyRouter } = require('./router');
const { MomentumBurstStrategy } = require('./plugins/momentum-burst');
const { TrendPullbackStrategy } = require('./plugins/trend-pullback');
const logger = require('../utils/logger');

let REDIS_CHANNELS: any;
try { REDIS_CHANNELS = require('/app/shared/constants').REDIS_CHANNELS; } catch (_) {
  try { REDIS_CHANNELS = require('../../../shared/constants').REDIS_CHANNELS; } catch (_) {}
}

class StrategyOrchestrator {
  constructor(options = {}) {
    this.redis = options.redis;
    this.regimeEngine = options.regimeEngine;
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.kafkaBrokers = (options.kafkaBrokers || process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.symbol = options.symbol || 'NIFTY';

    this.registry = new StrategyRegistry();
    this.router = new StrategyRouter(this.registry);
    this.pool = null;
    this.kafkaProducer = null;
    this.lastBreadth = null;
    this.lastRegime = null;
    this.interval = null;
    this.evalInterval = null;
  }

  async start() {
    logger.info('StrategyOrchestrator: starting...');

    // Register built-in strategies
    this.registry.register(new MomentumBurstStrategy());
    this.registry.register(new TrendPullbackStrategy());

    // Load config (enable/disable, override params)
    this.registry.loadConfig();

    // Connect TimescaleDB for candle fetching
    if (this.timescaleUrl) {
      this.pool = new Pool({ connectionString: this.timescaleUrl });
    }

    // Connect Kafka for publishing trade-signals
    try {
      const kafka = new Kafka({
        clientId: 'strategy-orchestrator',
        brokers: this.kafkaBrokers,
      });
      this.kafkaProducer = kafka.producer({ maxInFlightRequests: 1 });
      await this.kafkaProducer.connect();
      logger.info('StrategyOrchestrator: Kafka connected');
    } catch (err) {
      logger.warn({ err }, 'StrategyOrchestrator: Kafka unavailable (Redis-only mode)');
    }

    // Subscribe to breadth updates from L5
    if (this.redis) {
      await this.redis.subscribe('market_view', (data) => {
        this.lastBreadth = data;
      });
      try {
        const mv = await this.redis.get('market_view:latest');
        if (mv) this.lastBreadth = mv;
      } catch (e) { /* ignore */ }
    }

    // Poll regime state and evaluate strategies
    this.interval = setInterval(() => this.syncAndEvaluate(), 10000);
    setTimeout(() => this.syncAndEvaluate(), 1000);
  }

  async syncAndEvaluate() {
    // Get latest regime from engine or Redis
    this.lastRegime = this.regimeEngine
      ? this.regimeEngine.getState()
      : await this.fetchRegimeFromRedis();

    if (!this.lastRegime) return;

    this.router.updateRegime(this.lastRegime);

    // Fetch candles + breadth for evaluation context
    const ctx = await this.buildContext();
    if (!ctx) return;

    const signals = await this.router.evaluate(ctx);

    for (const signal of signals) {
      await this.emitSignal(signal);
    }
  }

  async buildContext() {
    if (!this.pool) return null;

    const timeframes = ['5m', '15m', '1h', 'D'];
    const candles = {};

    for (const tf of timeframes) {
      try {
        const table = `candles_${tf}`;
        const res = await this.pool.query(
          `SELECT time, open, high, low, close, volume FROM ${table} WHERE symbol = $1 ORDER BY time DESC LIMIT 100`,
          [this.symbol]
        );
        if (res.rows.length > 20) {
          candles[tf] = res.rows.reverse().map(r => ({
            time: r.time, open: parseFloat(r.open), high: parseFloat(r.high),
            low: parseFloat(r.low), close: parseFloat(r.close), volume: parseInt(r.volume) || 0,
          }));
        }
      } catch (e) {
        // Skip unavailable timeframes
      }
    }

    if (!candles['5m'] || candles['5m'].length < 20) return null;

    const breadthData = this.lastBreadth ? {
      advance_decline_ratio: this.lastBreadth.breadth?.advance_decline_ratio,
      market_sentiment: this.lastBreadth.breadth?.market_sentiment,
      percent_above_ema20: this.lastBreadth.breadth?.percent_above_ema20,
    } : null;

    return { candles, regime: this.lastRegime, breadth: breadthData };
  }

  async fetchRegimeFromRedis() {
    if (!this.redis) return null;
    try {
      return await this.redis.get('market-regime:latest');
    } catch (e) {
      return null;
    }
  }

  async emitSignal(signal) {
    logger.info({
      strategy: signal.strategyId,
      tier: signal.tier,
      direction: signal.direction,
      confidence: signal.confidence,
      reasons: signal.reasons,
    }, `Signal: ${signal.strategyId} ${signal.direction} @ conf ${signal.confidence}`);

    // Publish to Redis for dashboard/bot
    if (this.redis) {
      await this.redis.publish(REDIS_CHANNELS?.SIGNALS || 'signals:trade', signal);
      await this.redis.pushToList('signals:history', signal);
    }

    // Publish to Kafka for L10 execution
    if (this.kafkaProducer) {
      try {
        await this.kafkaProducer.send({
          topic: process.env.KAFKA_TOPIC_TRADE_SIGNALS || 'trade-signals',
          messages: [{
            key: `${signal.strategyId}:${signal.direction}:${Date.now()}`,
            value: JSON.stringify(signal),
            timestamp: Date.now().toString(),
            headers: { source: 'strategy-orchestrator', version: '1.0' },
          }],
        });
      } catch (err) {
        logger.error({ err }, 'StrategyOrchestrator: Kafka publish failed');
      }
    }
  }

  getState() {
    return {
      registry: this.registry.getStats(),
      router: this.router.getState(),
    };
  }

  async stop() {
    if (this.interval) clearInterval(this.interval);
    if (this.evalInterval) clearInterval(this.evalInterval);
    if (this.kafkaProducer) await this.kafkaProducer.disconnect();
    if (this.pool) await this.pool.end();
    logger.info('StrategyOrchestrator: stopped');
  }
}

module.exports = { StrategyOrchestrator };
