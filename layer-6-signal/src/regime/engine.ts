const { Pool } = require('pg');
const { Kafka } = require('kafkajs');
const { detectTrend, detectVolatility, detectPhase, computeTFAlignment, ATR } = require('./indicators');
const logger = require('../utils/logger');

let REDIS_CHANNELS: any;
try { REDIS_CHANNELS = require('/app/shared/constants').REDIS_CHANNELS; } catch (_) {
  try { REDIS_CHANNELS = require('../../../shared/constants').REDIS_CHANNELS; } catch (_) {}
}

const INDEX_SYMBOLS = ['NIFTY', 'BANKNIFTY'];

class RegimeEngine {
  constructor(options = {}) {
    this.redis = options.redis;
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.kafkaBrokers = (options.kafkaBrokers || process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.pollIntervalMs = options.pollIntervalMs || 60000;
    this.symbol = options.symbol || 'NIFTY';
    this.state = null;
    this.pool = null;
    this.kafkaProducer = null;
    this.interval = null;
    this.timer = null;
    this.candleCache = {};
    this.lastBreadth = null;
  }

  async start() {
    logger.info('RegimeEngine: starting...');

    // Connect TimescaleDB
    if (this.timescaleUrl) {
      this.pool = new Pool({ connectionString: this.timescaleUrl });
      logger.info('RegimeEngine: TimescaleDB connected');
    } else {
      logger.warn('RegimeEngine: no TIMESCALE_URL, regime engine will not fetch candles');
    }

    // Connect Kafka
    try {
      const kafka = new Kafka({
        clientId: 'regime-engine',
        brokers: this.kafkaBrokers,
      });
      this.kafkaProducer = kafka.producer({ maxInFlightRequests: 1 });
      await this.kafkaProducer.connect();
      logger.info('RegimeEngine: Kafka connected');
    } catch (err) {
      logger.warn({ err }, 'RegimeEngine: Kafka connection failed (will use Redis only)');
    }

    // Subscribe to market_view from L5 for breadth data
    if (this.redis) {
      try {
        await this.redis.subscribe('market_view', (data) => {
          this.lastBreadth = data;
        });
        logger.info('RegimeEngine: subscribed to market_view');
      } catch (err) {
        logger.warn({ err }, 'RegimeEngine: could not subscribe to market_view');
      }
    }

    // Also try to load latest breadth from Redis on startup
    if (this.redis) {
      try {
        const mv = await this.redis.get('market_view:latest');
        if (mv) this.lastBreadth = mv;
      } catch (e) { /* ignore */ }
    }

    // Run immediately, then on interval
    await this.evaluate();
    this.interval = setInterval(() => this.evaluate(), this.pollIntervalMs);

    // Also check for new candles every 15s to react faster
    this.timer = setInterval(() => this.checkNewCandles(), 15000);
  }

  async stop() {
    if (this.interval) clearInterval(this.interval);
    if (this.timer) clearInterval(this.timer);
    if (this.kafkaProducer) await this.kafkaProducer.disconnect();
    if (this.pool) await this.pool.end();
    logger.info('RegimeEngine: stopped');
  }

  async checkNewCandles() {
    if (!this.pool) return;
    const now = new Date();
    const since = new Date(now.getTime() - 90000); // 90s back
    try {
      const res = await this.pool.query(
        `SELECT COUNT(*) as cnt FROM candles_1m WHERE symbol = $1 AND time > $2`,
        [this.symbol, since.toISOString()]
      );
      if (parseInt(res.rows[0].cnt) > 0) {
        await this.evaluate();
      }
    } catch (err) {
      // Silent — polling handles it
    }
  }

  async evaluate() {
    try {
      const candles = await this.fetchCandles();
      if (!candles || candles['5m'].length < 20) {
        logger.debug('RegimeEngine: insufficient candle data');
        return;
      }

      const regime = this.classify(candles);
      if (!regime) return;

      this.state = regime;
      await this.publish(regime);
    } catch (err) {
      logger.error({ err }, 'RegimeEngine: evaluate error');
    }
  }

  async fetchCandles() {
    if (!this.pool) return null;

    const timeframes = [
      { name: '5m',  table: 'candles_5m',  limit: 100 },
      { name: '15m', table: 'candles_15m', limit: 80  },
      { name: '1h',  table: 'candles_1h',  limit: 60  },
      { name: '4h',  table: 'candles_4h',  limit: 50  },
      { name: 'D',   table: 'candles_1d',  limit: 40  },
      { name: 'W',   table: 'candles_weekly', limit: 20 },
    ];

    const result = {};

    for (const tf of timeframes) {
      try {
        let res;
        try {
          res = await this.pool.query(
            `SELECT time, open, high, low, close, volume FROM ${tf.table} WHERE symbol = $1 ORDER BY time DESC LIMIT $2`,
            [this.symbol, tf.limit]
          );
        } catch (e) {
          // Fallback to 1m and aggregate in memory
          logger.debug(`RegimeEngine: ${tf.table} not available, trying from candles_1m`);
          const lookbackMinutes = tf.name === 'D' ? 1440 : parseInt(tf.name) * tf.limit;
          res = await this.pool.query(
            `SELECT time, open, high, low, close, volume FROM candles_1m WHERE symbol = $1 AND time > NOW() - INTERVAL '${lookbackMinutes} minutes' ORDER BY time DESC`,
            [this.symbol]
          );
        }

        let rows = res.rows.reverse();
        if (rows.length < tf.limit / 2) continue;

        // If we fell back to 1m, aggregate to the target timeframe
        if (res.rows[0] && !tf.table.includes('candles_')) {
          const intervalMinutes = tf.name === 'D' ? 1440 : parseInt(tf.name);
          rows = this.aggregateToTF(rows, intervalMinutes);
        }

        result[tf.name] = rows.map(r => ({
          time: r.time,
          open: parseFloat(r.open),
          high: parseFloat(r.high),
          low: parseFloat(r.low),
          close: parseFloat(r.close),
          volume: parseInt(r.volume) || 0,
        }));
      } catch (err) {
        logger.debug({ err, tf: tf.name }, 'RegimeEngine: failed to fetch candles');
      }
    }

    return result;
  }

  aggregateToTF(candles, intervalMinutes) {
    const buckets = new Map();
    for (const c of candles) {
      const t = new Date(c.time);
      const bucket = Math.floor(t.getTime() / (intervalMinutes * 60000)) * (intervalMinutes * 60000);
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { time: new Date(bucket), open: parseFloat(c.open), high: parseFloat(c.high), low: parseFloat(c.low), close: parseFloat(c.close), volume: parseInt(c.volume) || 0 });
      } else {
        const b = buckets.get(bucket);
        b.high = Math.max(b.high, parseFloat(c.high));
        b.low = Math.min(b.low, parseFloat(c.low));
        b.close = parseFloat(c.close);
        b.volume += parseInt(c.volume) || 0;
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
  }

  classify(candles) {
    // Analyze each timeframe
    const tfResults = {};
    for (const [tfName, tfCandles] of Object.entries(candles)) {
      if (tfCandles.length < 10) continue;
      const trend = detectTrend(tfCandles, 20);
      tfResults[tfName] = trend;
    }

    if (Object.keys(tfResults).length === 0) return null;

    // Compute TF alignment
    const { alignment, confidence: alignmentConfidence } = computeTFAlignment(tfResults);

    // Primary trend from higher timeframe (1h or D)
    const primaryTF = tfResults['1h'] || tfResults['15m'] || tfResults['5m'];
    const dominantTrend = primaryTF ? primaryTF.trend : 'RANGE';
    const dominantStrength = primaryTF ? primaryTF.strength : 0;

    // Volatility
    const dailyCandles = candles['D'] || candles['1h'] || candles['15m'];
    const vixValue = this.lastBreadth ? this.lastBreadth.vix : null;
    const volatility = dailyCandles ? detectVolatility(dailyCandles, vixValue) : 'NORMAL';

    // Phase
    const phaseCandles = candles['1h'] || candles['D'] || candles['15m'];
    const phase = phaseCandles ? detectPhase(dominantTrend, dominantStrength, volatility, phaseCandles) : 'CONSOLIDATING';

    // Determine tradeable tiers
    const tradeableTiers = [];
    if (dominantTrend !== 'RANGE' && dominantStrength > 0.3 && volatility !== 'HIGH') {
      if (alignmentConfidence > 0.6 && tfResults['1h'] && tfResults['D']) tradeableTiers.push('T3');
      if (alignmentConfidence > 0.3 && tfResults['15m']) tradeableTiers.push('T2');
      tradeableTiers.push('T1');
    } else if (dominantTrend !== 'RANGE' && dominantStrength > 0.2) {
      tradeableTiers.push('T1');
    }

    // Safe fallback
    if (tradeableTiers.length === 0 && volatility !== 'HIGH') {
      tradeableTiers.push('T1');
    }

    // Extract breadth state from last known market_view
    const breadthState = this.lastBreadth ? {
      advance_decline_ratio: this.lastBreadth.breadth?.advance_decline_ratio,
      market_sentiment: this.lastBreadth.breadth?.market_sentiment,
      percent_above_ema20: this.lastBreadth.breadth?.percent_above_ema20,
    } : null;

    // Sector leaders
    let sectorLeaders = [];
    if (this.lastBreadth && this.lastBreadth.sector_performance) {
      sectorLeaders = Object.entries(this.lastBreadth.sector_performance)
        .filter(([, s]) => s.momentum === 'STRONG_UP' || s.momentum === 'UP')
        .map(([name]) => name);
    }

    const confidence = alignmentConfidence * (1 - (dominantStrength > 0 ? 0 : 0.3));

    return {
      timestamp: new Date().toISOString(),
      symbol: this.symbol,
      trend: dominantTrend,
      strength: dominantStrength,
      volatility,
      phase,
      tfAlignment: alignment,
      alignmentConfidence,
      breadthState,
      sectorLeaders,
      tradeableTiers,
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  async publish(regime) {
    // Publish to Redis
    if (this.redis) {
      try {
        await this.redis.set('market-regime:latest', regime, { EX: 120 }); // 2 min TTL — stale regime must expire
        await this.redis.publish(REDIS_CHANNELS?.REGIME || 'market-regime', regime);
      } catch (err) {
        logger.error({ err }, 'RegimeEngine: Redis publish failed');
      }
    }

    // Publish to Kafka
    if (this.kafkaProducer) {
      try {
        await this.kafkaProducer.send({
          topic: process.env.KAFKA_TOPIC_MARKET_REGIME || 'market-regime',
          messages: [{
            key: this.symbol,
            value: JSON.stringify(regime),
            timestamp: Date.now().toString(),
            headers: { source: 'regime-engine', version: '1.0' },
          }],
        });
        logger.debug('RegimeEngine: published to market-regime topic');
      } catch (err) {
        logger.error({ err }, 'RegimeEngine: Kafka publish failed');
      }
    }

    logger.info({
      symbol: this.symbol,
      trend: regime.trend,
      strength: regime.strength,
      volatility: regime.volatility,
      phase: regime.phase,
      tiers: regime.tradeableTiers,
      confidence: regime.confidence,
    }, `🧠 Regime: ${regime.trend} | ${regime.phase} | ${regime.volatility} | Tiers: ${regime.tradeableTiers.join(',') || 'NONE'}`);
  }

  getState() {
    return this.state;
  }
}

module.exports = { RegimeEngine };
