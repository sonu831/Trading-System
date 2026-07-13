const { systemStatusSchema, backfillTriggerSchema } = require('./schemas');

let REDIS_CHANNELS: any;
try { REDIS_CHANNELS = require('/app/shared/constants').REDIS_CHANNELS; } catch (_) {
  try { REDIS_CHANNELS = require('../../../../shared/constants').REDIS_CHANNELS; } catch (_) {}
}

/**
 * System Routes
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function systemRoutes(fastify, options) {
  const container = require('../../container');
  const systemController = container.resolve('systemController');

  // ─────────────────────────────────────────────────────────────
  // SYSTEM STATUS
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/system-status', {
    schema: systemStatusSchema,
    handler: systemController.getSystemStatus,
  });

  // ─────────────────────────────────────────────────────────────
  // ALERTS — notification feed from Kafka/Redis
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // BACKFILL MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  fastify.post('/api/v1/system/backfill/trigger', {
    schema: backfillTriggerSchema,
    handler: systemController.triggerBackfill,
  });

  fastify.get('/api/v1/system/backfill/swarm/status', {
    handler: systemController.getSwarmStatus,
  });

  // Push backfill status log (ingestion calls this instead of writing Redis directly)
  fastify.post('/api/v1/system/log', {
    schema: {
      description: 'Push a system log entry (ingestion backfill progress, errors, etc.)',
      tags: ['System'],
      body: {
        type: 'object',
        properties: {
          level: { type: 'string', enum: ['info', 'warn', 'error'] },
          message: { type: 'string' },
          data: { type: 'object' },
        },
        required: ['message'],
      },
    },
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const entry = JSON.stringify({
          timestamp: new Date().toISOString(),
          level: req.body.level || 'info',
          message: req.body.message,
          data: req.body.data || {},
        });
        await redis.lPush('system:layer1:logs', entry);
        await redis.lTrim('system:layer1:logs', 0, 99);

        // Also set backfill status if data contains progress info
        if (req.body.data?.progress != null) {
          await redis.set('system:layer1:backfill', JSON.stringify({
            status: 1,
            progress: req.body.data.progress,
            details: req.body.message,
            job_type: 'historical_backfill',
            timestamp: Date.now(),
          }));
        }
        return { success: true };
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // SESSION CLOCK — cockpit safety bar
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/session/clock', {
    schema: { description: 'Market session clock: entry cutoff, square-off, expiry flags', tags: ['Market'] },
    handler: async (req, reply) => {
      const IST_OFFSET = 5.5 * 3600000;
      const now = new Date(Date.now() + IST_OFFSET);
      const h = now.getUTCHours(), m = now.getUTCMinutes(), d = now.getUTCDay();
      const isWeekend = d === 0 || d === 6;
      const marketOpen = h >= 9 && h < 15 && !isWeekend;

      const minsTo = (th, tm) => ({ hours: th - h, minutes: tm - m, totalMinutes: (th * 60 + tm) - (h * 60 + m) });

      return {
        success: true,
        data: {
          marketOpen,
          isWeekend,
          entryCutoff: minsTo(15, 0),
          squareOff: minsTo(15, 15),
          serverTime: new Date().toISOString(),
        },
      };
    },
  });

  // ─────────────────────────────────────────────────────────────
  // INDEX QUOTE — spot LTP for cockpit
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/market/index/:underlying/quote', {
    schema: { description: 'Index spot quote (LTP, change, high, low, VWAP, ATR)', tags: ['Market'] },
    handler: async (req, reply) => {
      try {
        const container = require('../../container');
        const redis = container.cradle.redis;
        const { underlying } = req.params;
        const sym = underlying.toUpperCase();

        // Latest candle from Redis
        const raw = await redis.get(`candle:${sym}:1m`);
        const candle = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;

        // Spot price from Redis
        const spotRaw = await redis.get(`ltp:${sym}`);
        const spot = spotRaw ? (typeof spotRaw === 'string' ? JSON.parse(spotRaw) : spotRaw) : null;

        // Previous day close
        const prevRaw = await redis.get(`candle:${sym}:1d`);
        const prevDay = prevRaw ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) : null;

        const ltp = candle?.close || spot?.price || null;
        const prevClose = prevDay?.close || null;
        const change = ltp && prevClose ? ltp - prevClose : null;
        const changePct = change && prevClose ? (change / prevClose) * 100 : null;

        return {
          success: true,
          data: {
            underlying: sym,
            ltp,
            change,
            changePct,
            high: candle?.high || ltp,
            low: candle?.low || ltp,
            open: candle?.open || ltp,
            vwap: candle?.vwap || null,
            atr: null, // computed in L4
            volume: candle?.volume || 0,
            timestamp: candle?.timestamp || Date.now(),
          },
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // INDEX CANDLES — OHLCV series for cockpit chart
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/market/index/:underlying/candles', {
    schema: {
      description: 'OHLCV candles for index chart (1m or 5m)',
      tags: ['Market'],
      querystring: {
        type: 'object',
        properties: {
          tf: { type: 'string', default: '1m', enum: ['1m', '5m', '15m', '1h'] },
          limit: { type: 'integer', default: 200, minimum: 1, maximum: 500 },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const container = require('../../container');
        const prisma = container.cradle.prisma;
        const { underlying } = req.params;
        const sym = underlying.toUpperCase();
        const tf = req.query.tf || '1m';
        const limit = Math.min(req.query.limit || 200, 500);

        const tableMap = { '1m': 'candles_1m', '5m': 'candles_5m', '15m': 'candles_15m', '1h': 'candles_1h' };
        const table = tableMap[tf] || 'candles_1m';

        const rows = await prisma.$queryRawUnsafe(
          `SELECT time, open, high, low, close, volume FROM ${table} WHERE symbol = $1 ORDER BY time DESC LIMIT $2`,
          sym, limit
        );

        const candles = (rows || []).reverse().map((r) => ({
          time: new Date(r.time).getTime() / 1000,
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume || 0),
        }));

        return { success: true, data: { underlying: sym, timeframe: tf, candles } };
      } catch (err) {
        // Fallback: empty data on query failure
        return { success: true, data: { underlying: req.params.underlying, timeframe: req.query.tf || '1m', candles: [] } };
      }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // EXECUTION STATE
  // ⚠️ Moved to modules/execution/routes.js -- DO NOT DUPLICATE
  // ─────────────────────────────────────────────────────────────

  fastify.get('/api/v1/backfill', {
    handler: systemController.getBackfillJobs,
  });

  fastify.get('/api/v1/backfill/:jobId', {
    handler: systemController.getBackfillJob,
  });

  fastify.patch('/api/v1/backfill/:jobId', {
    handler: systemController.updateBackfillJob,
  });

  // ─────────────────────────────────────────────────────────────
  // DATA AVAILABILITY (Used by Ingestion Layer)
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/data/availability', {
    handler: systemController.getDataAvailability,
  });

  fastify.put('/api/v1/data/availability', {
    handler: systemController.updateDataAvailability,
  });

  fastify.get('/api/v1/data/stats', {
    handler: systemController.getDataStats,
  });

  fastify.get('/api/v1/data/gaps', {
    handler: systemController.getSymbolsWithGaps,
  });

  // ─────────────────────────────────────────────────────────────
  // HEALTH & NEWS
  // ─────────────────────────────────────────────────────────────
  const healthController = require('./health.controller');
  fastify.get('/api/v1/health/detailed', healthController.getDetailedHealth);

  const newsController = require('./news.controller');
  fastify.get('/api/v1/news', newsController.getNews);

  // ─────────────────────────────────────────────────────────────
  // OPTIONS — expiries, chain, analytics
  // ─────────────────────────────────────────────────────────────
  function toOption(rows, strike, type) {
    const r = rows.find(x => Number(x.strike) === strike && x.option_type === type);
    return r ? { ltp: Number(r.ltp||0), bid: Number(r.bid||0), ask: Number(r.ask||0), oi: Number(r.open_interest||0), vol: Number(r.volume||0), iv: Number(r.iv||0) } : null;
  }

  fastify.get('/api/v1/options/expiries', {
    handler: async (req, reply) => {
      const u = (req.query.underlying || 'NIFTY').toUpperCase();
      const IST = 5.5 * 3600000;
      const n = new Date(Date.now() + IST);
      const today = new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
      const out = [];
      for (let i = 0; i < 8; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + (4 - d.getDay() + 7) % 7 + i * 7);
        if (d > today) { out.push({ date: d.toISOString().split('T')[0], dte: Math.ceil((d-today)/86400000), type: d.getDate()>22?'monthly':'weekly' }); if (out.length>=4) break; }
      }
      return { success: true, data: { underlying: u, expiries: out } };
    },
  });

  fastify.get('/api/v1/options/chain', {
    handler: async (req, reply) => {
      try {
        const { prisma, redis } = require('../../container').cradle;
        const u = (req.query.underlying || 'NIFTY').toUpperCase();
        const n = parseInt(req.query.strikes) || 7;
        const step = u === 'BANKNIFTY' ? 100 : 50;
        const sr = await redis.get(`ltp:${u}`);
        const s = sr ? (typeof sr === 'string' ? JSON.parse(sr) : sr) : null;
        const spot = s?.price || s?.close || 0;
        if (!spot) return { success: true, data: { underlying: u, spot: null, atm: 0, rows: [] } };
        const atm = Math.round(spot / step) * step;
        const strikes = [];
        for (let i = atm - n * step; i <= atm + n * step; i += step) strikes.push(i);
        let rows = [];
        try {
          rows = await prisma.$queryRawUnsafe(
            "SELECT strike, option_type, ltp, bid, ask, open_interest, volume, iv FROM options_chain WHERE symbol=$1 AND time>=NOW()-INTERVAL'5 minutes' AND strike=ANY($2::numeric[]) ORDER BY strike, option_type",
            `${u}-OC`, strikes
          );
        } catch (_) {}
        const chain = strikes.map(k => ({ strike: k, isATM: k === atm, ce: toOption(rows, k, 'CE'), pe: toOption(rows, k, 'PE') }));
        return { success: true, data: { underlying: u, spot, atm, rows: chain } };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  fastify.get('/api/v1/options/analytics', {
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const u = (req.query.underlying || 'NIFTY').toUpperCase();
        const p = await redis.get(`pcr:${u}`);
        const iv = await redis.get(`iv:${u}`);
        return { success: true, data: { underlying: u, pcr: p ? parseFloat(p) : null, atmIV: iv ? parseFloat(iv) : null } };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // STRATEGIES — list + update params
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/strategies', {
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        // Read strategy config from Redis (set by L6 StrategyOrchestrator)
        const raw = await redis.get('strategies:config');
        if (raw) {
          return { success: true, data: typeof raw === 'string' ? JSON.parse(raw) : raw };
        }
        // Fallback: return default strategy config from shared config
        const defaultConfig = [
          { id: 'momentum-burst', name: 'Momentum Burst', tier: 'T1', description: 'Expansion candles on 5m', enabled: true, params: { expansionMultiplier: 1.5, rsiGateLow: 55, rsiGateHigh: 75, breadthMinAD: 1.2, volumeMultiplier: 1.2, slPct: 0.18, targetR: 2.5 } },
          { id: 'trend-pullback', name: 'Trend Pullback', tier: 'T2', description: 'EMA21 pullback on 15m', enabled: true, params: { pullbackPct: 0.05, minRegimeStrength: 0.3, minTfAlignment: 0.5, slPct: 0.25, targetR: 2.5 } },
        ];
        return { success: true, data: defaultConfig };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  fastify.patch('/api/v1/strategies/:id', {
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const id = req.params.id;
        const raw = await redis.get('strategies:config');
        const config = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        const idx = config.findIndex(s => s.id === id);
        if (idx < 0) return { success: false, error: 'Strategy not found' };
        config[idx] = { ...config[idx], ...req.body };
        await redis.set('strategies:config', JSON.stringify(config));
        await redis.publish(REDIS_CHANNELS?.STRATEGIES_CHANGED || 'strategies-changed', JSON.stringify({ id, action: 'updated' }));
        return { success: true, data: config[idx] };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // RISK CONFIG — read + update limits
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/risk/config', {
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const raw = await redis.get('risk:config');
        const defaults = {
          maxLots: 1, maxConcurrent: 1, maxTradesPerDay: 5,
          maxDailyLoss: 2500, maxRiskPerTradePct: 0.02,
          entryCutoff: '15:00', squareOff: '15:15', mode: process.env.TRADE_MODE || 'paper',
        };
        return { success: true, data: raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : defaults };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  fastify.patch('/api/v1/risk/config', {
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const raw = await redis.get('risk:config');
        const current = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
        const updated = { ...current, ...req.body };
        await redis.set('risk:config', JSON.stringify(updated));
        await redis.publish(REDIS_CHANNELS?.RISK_CHANGED || 'risk-changed', JSON.stringify(updated));
        return { success: true, data: updated };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // FEED HEALTH — per-stream staleness
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/health/feeds', {
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const feeds = {};
        const keys = [
          ['tick', 'ltp:NIFTY'],
          ['chain', 'option:NIFTY:latest'],
          ['regime', 'market-regime:latest'],
          ['execution', 'execution:state'],
        ];
        for (const [name, key] of keys) {
          const raw = await redis.get(key);
          if (raw) {
            const d = typeof raw === 'string' ? JSON.parse(raw) : raw;
            feeds[name] = { updatedAt: d.timestamp || d.updatedAt || null, available: true };
          } else {
            feeds[name] = { available: false };
          }
        }
        return { success: true, data: feeds };
      } catch (err) { return { success: false, error: err.message }; }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // BACKTEST PROXY — proxy to L9 AI service
  // ─────────────────────────────────────────────────────────────
  fastify.post('/api/v1/backtest', {
    schema: {
      description: 'Run a backtest via L9 AI service',
      tags: ['Backtest'],
      body: {
        type: 'object',
        properties: {
          strategy: { type: 'string' },
          fromDate: { type: 'string' },
          toDate: { type: 'string' },
          capital: { type: 'number' },
          regimeBucket: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const axios = require('axios');
        const aiUrl = process.env.AI_URL || 'http://ai-inference:8000';
        const resp = await axios.post(`${aiUrl}/backtest`, req.body, { timeout: 30000 });
        return { success: true, data: resp.data };
      } catch (err) {
        return { success: false, error: err.response?.data?.detail || err.message };
      }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // PREDICT PROXY — proxy to L9 AI service (returns abstain if unavailable)
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/predict', {
    schema: {
      description: 'Get AI prediction — returns abstain state when model is not ready',
      tags: ['AI'],
      querystring: {
        type: 'object',
        properties: {
          underlying: { type: 'string', default: 'NIFTY' },
          horizon: { type: 'string', default: 'scalp' },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const axios = require('axios');
        const aiUrl = process.env.AI_URL || 'http://ai-inference:8000';
        const resp = await axios.get(`${aiUrl}/predict`, {
          params: { underlying: req.query.underlying, horizon: req.query.horizon },
          timeout: 10000,
        });
        return { success: true, data: resp.data };
      } catch (err) {
        // Return abstain — never fabricate a prediction
        return {
          success: true,
          data: {
            status: 'abstain',
            direction: null,
            probability: null,
            confidence: null,
            model_version: null,
            reason: err.response?.data?.detail || err.message || 'AI service unavailable',
          },
        };
      }
    },
  });
  fastify.get('/api/v1/alerts', {
    schema: {
      description: 'Notification feed — kill-switch trips, NO-STOP warnings, fills, rejects',
      tags: ['Alerts'],
      querystring: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['info', 'warn', 'error', 'critical'] },
          limit: { type: 'integer', default: 50 },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const { redis } = require('../../container').cradle;
        const limit = Math.min(req.query.limit || 50, 200);
        const severity = req.query.severity;
        // Alerts pushed to Redis list `alerts:feed` by L8 notification service
        const raw = await redis.lRange('alerts:feed', 0, limit - 1);
        let alerts = raw.map(r => typeof r === 'string' ? JSON.parse(r) : r);
        if (severity) alerts = alerts.filter(a => a.severity === severity);
        return { success: true, data: { alerts, count: alerts.length } };
      } catch (err) {
        return { success: true, data: { alerts: [], count: 0 } };
      }
    },
  });

  // ─────────────────────────────────────────────────────────────
  // OPTIONS EXPIRIES — (moved up, duplicate guard)
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/options/expiries-v2', {
    handler: async (req, reply) => {
      const u = (req.query.underlying || 'NIFTY').toUpperCase();
      const IST = 5.5 * 3600000;
      const n = new Date(Date.now() + IST);
      const today = new Date(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
      const out = [];
      for (let i = 0; i < 8; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + (4 - d.getDay() + 7) % 7 + i * 7);
        if (d > today) { out.push({ date: d.toISOString().split('T')[0], dte: Math.ceil((d - today) / 86400000), type: d.getDate() > 22 ? 'monthly' : 'weekly' }); if (out.length >= 4) break; }
      }
      return { success: true, data: { underlying: u, expiries: out } };
    },
  });
}

module.exports = systemRoutes;
