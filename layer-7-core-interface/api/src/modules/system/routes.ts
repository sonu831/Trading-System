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

        // Latest candle from Redis (WebSocket feed, fastest path)
        const raw = await redis.get(`candle:${sym}:1m`);
        const candle = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
        const spotRaw = await redis.get(`ltp:${sym}`);
        const spot = spotRaw ? (typeof spotRaw === 'string' ? JSON.parse(spotRaw) : spotRaw) : null;

        // Previous day close
        const prevRaw = await redis.get(`candle:${sym}:1d`);
        const prevDay = prevRaw ? (typeof prevRaw === 'string' ? JSON.parse(prevRaw) : prevRaw) : null;

        let ltp = candle?.close || spot?.price || null;
        const prevClose = prevDay?.close || null;

        // ── REST fallback: fetch from MStock historical API when no WebSocket data ──
        if (!ltp) {
          try {
            const { getAdapter } = require('../broker/adapters');
            const brokerService = container.resolve('brokerService');
            const creds = await brokerService.getDecryptedCredentials('mstock');
            if (creds?.api_key) {
              const adapter = getAdapter('mstock', creds.api_key);
              const { createClient } = require('redis');
              const r2 = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
              await r2.connect();
              const raw = await r2.get('broker:session:mstock');
              await r2.disconnect();
              const jwt = raw ? JSON.parse(raw)?.token : null;
              if (jwt) {
                const TOKENS: Record<string, string> = { NIFTY: '26000', BANKNIFTY: '26009', FINNIFTY: '26037' };
                const token = TOKENS[sym];
                if (token) {
                  adapter.setAccessToken(jwt);
                  const result = await adapter.getQuote({ mode: 'LTP', exchangeTokens: { NSE: [token] } });
                  const fetched = result?.data?.fetched?.[0] || result?.fetched?.[0] || {};
                  if (fetched.ltp) {
                    ltp = Number(fetched.ltp);
                    redis.publisher.set(`ltp:${sym}`, JSON.stringify({ price: ltp, timestamp: new Date().toISOString() }), { EX: 60 }).catch(() => {});
                  }
                }
              }
            }
          } catch (e: any) { console.error(`[index-quote] REST fallback for ${sym}:`, e.message); }
        }

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
            atr: null,
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
      description: 'OHLCV candles for index chart (1m, 5m, 15m, 1h, 1d)',
      tags: ['Market'],
      querystring: {
        type: 'object',
        properties: {
          tf: { type: 'string', default: '1m', enum: ['1m', '5m', '15m', '1h', '1d'] },
          limit: { type: 'integer', default: 200, minimum: 1, maximum: 500 },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const container = require('../../container');
        const { underlying } = req.params;
        const sym = underlying.toUpperCase();
        const tf = (req.query as any).tf || '1m';
        const limit = Math.min((req.query as any).limit || 200, 500);

        // 1. Redis cache (fast path — CandleBuffer pushes here)
        if (tf === '1m') {
          try {
            const redis = container.cradle.redis?.publisher || container.cradle.redis;
            const key = `candles:live:${sym}:1m`;
            const len = await redis.lLen(key);
            if (len > 0) {
              const raw = await redis.lRange(key, Math.max(0, len - limit), -1);
              const candles = raw.map((entry: string) => {
                const c = JSON.parse(entry);
                return { time: new Date(c.time).getTime() / 1000, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume || 0 };
              });
              return { success: true, data: { underlying: sym, timeframe: tf, candles, source: 'redis' } };
            }
          } catch (_) {}
        }

        // 2. TimescaleDB
        const prisma = container.cradle.prisma;
        const tableMap: Record<string, string> = { '1m': 'candles_1m', '5m': 'candles_5m', '15m': 'candles_15m', '1h': 'candles_1h', '1d': 'candles_1d' };
        const table = tableMap[tf] || 'candles_1m';
        let rows: any[] = [];
        try {
          rows = await prisma.$queryRawUnsafe(
            `SELECT time, open, high, low, close, volume FROM ${table} WHERE symbol = $1 ORDER BY time DESC LIMIT $2`,
            sym, limit
          );
        } catch (_) {}

        // 3. MStock historical API fallback
        if (!rows.length) {
          try {
            const { getAdapter } = require('../broker/adapters');
            const brokerService = require('../../container').resolve('brokerService');
            const creds = await brokerService.getDecryptedCredentials('mstock');
            const { createClient } = require('redis');
            const r2 = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
            await r2.connect();
            const raw = await r2.get('broker:session:mstock');
            await r2.disconnect();
            const jwt = raw ? JSON.parse(raw)?.token : null;
            if (creds?.api_key && jwt) {
              const TOKENS: Record<string, string> = { NIFTY: '26000', BANKNIFTY: '26009', FINNIFTY: '26037' };
              const token = TOKENS[sym];
              if (token) {
                const adapter = getAdapter('mstock', creds.api_key);
                adapter.setAccessToken(jwt);
                // MStock interval mapping: ONE_MINUTE, FIVE_MINUTE, FIFTEEN_MINUTE, ONE_HOUR, ONE_DAY
                const intervalMap: Record<string, string> = { '1m': 'ONE_MINUTE', '5m': 'FIVE_MINUTE', '15m': 'FIFTEEN_MINUTE', '1h': 'ONE_HOUR', '1d': 'ONE_DAY' };
                const interval = intervalMap[tf] || 'ONE_MINUTE';
                const to = new Date();
                const from = new Date(to.getTime() - (limit * parseTfMs(tf)));
                const fromdate = from.toISOString().split('T')[0] + ' ' + from.toTimeString().split(' ')[0];
                const todate = to.toISOString().split('T')[0] + ' ' + to.toTimeString().split(' ')[0];
                const result = await adapter.getHistoricalData({
                  exchange: 'NSE', symboltoken: token, interval,
                  fromdate, todate,
                });
                const candles = (result?.data?.candles || []).map((c: any) => {
                  if (Array.isArray(c)) return { time: new Date(c[0]).getTime() / 1000, open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] || 0 };
                  return { time: new Date(c.time || c[0]).getTime() / 1000, open: Number(c.open || c[1]), high: Number(c.high || c[2]), low: Number(c.low || c[3]), close: Number(c.close || c[4]), volume: Number(c.volume || c[5] || 0) };
                });
                return { success: true, data: { underlying: sym, timeframe: tf, candles, source: 'mstock' } };
              }
            }
          } catch (_) {}
        }

        const candles = (rows || []).reverse().map((r: any) => ({
          time: new Date(r.time).getTime() / 1000,
          open: Number(r.open),
          high: Number(r.high),
          low: Number(r.low),
          close: Number(r.close),
          volume: Number(r.volume || 0),
        }));

        return { success: true, data: { underlying: sym, timeframe: tf, candles, source: 'timescaledb' } };
      } catch (err: any) {
        return { success: true, data: { underlying: req.params.underlying, timeframe: (req.query as any).tf || '1m', candles: [] } };
      }
    },
  });

  function parseTfMs(tf: string): number {
    const map: Record<string, number> = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000, '1d': 86400000 };
    return map[tf] || 60000;
  }

  // ─────────────────────────────────────────────────────────────
  // MARKET VIEW — handled in modules/market/routes.ts
  // ─────────────────────────────────────────────────────────────

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

  // Return configured Nifty 50 symbols (token map) — available before any backfill
  fastify.get('/api/v1/data/symbols', {
    handler: systemController.getSymbolList,
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
        const sr = await redis.publisher.get(`ltp:${u}`);
        const s = sr ? (typeof sr === 'string' ? JSON.parse(sr) : sr) : null;
        let spot: number = s?.price || s?.close || 0;
        if (!spot) {
          // Fallback: fetch live spot from MStock 
          try {
            const { getAdapter } = require('../broker/adapters');
            const brokerService = require('../../container').resolve('brokerService');
            const creds = await brokerService.getDecryptedCredentials('mstock');
            const { createClient } = require('redis');
            const r2 = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
            await r2.connect();
            const raw = await r2.get('broker:session:mstock');
            await r2.disconnect();
            const jwt = raw ? JSON.parse(raw)?.token : null;
            if (creds?.api_key && jwt) {
              const TOKENS: Record<string, string> = { NIFTY: '26000', BANKNIFTY: '26009', FINNIFTY: '26037' };
              const token = TOKENS[u];
              if (token) {
                const adapter = getAdapter('mstock', creds.api_key);
                adapter.setAccessToken(jwt);
                const result = await adapter.getQuote({ mode: 'LTP', exchangeTokens: { NSE: [token] } });
                const fetched = result?.data?.fetched?.[0] || result?.fetched?.[0] || {};
                if (fetched.ltp) {
                  spot = Number(fetched.ltp);
                  redis.publisher.set(`ltp:${u}`, JSON.stringify({ price: spot, timestamp: new Date().toISOString() }), { EX: 60 }).catch(() => {});
                }
              }
            }
          } catch (_) {}
        }
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

        // No DB data: build synthetic chain from spot LTP
        if (!rows.length) {
          rows = [];
          for (const k of strikes) {
            const dist = Math.abs(k - spot);
            const cePremium = Math.max(0.5, spot - k + dist * 0.15);
            const pePremium = Math.max(0.5, k - spot + dist * 0.15);
            const ivBase = 14 + Math.min(30, dist / spot * 100);
            rows.push({ strike: k, option_type: 'CE', ltp: Math.round(cePremium * 100) / 100, bid: Math.round((cePremium * 0.9) * 100) / 100, ask: Math.round((cePremium * 1.1) * 100) / 100, open_interest: 0, volume: 0, iv: Math.round(ivBase * 10) / 10 });
            rows.push({ strike: k, option_type: 'PE', ltp: Math.round(pePremium * 100) / 100, bid: Math.round((pePremium * 0.9) * 100) / 100, ask: Math.round((pePremium * 1.1) * 100) / 100, open_interest: 0, volume: 0, iv: Math.round(ivBase * 10) / 10 });
          }
        }
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

  // ─────────────────────────────────────────────────────────────
  // TRADINGVIEW UDF DATA FEED — feeds our live candles to TV widget
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/tv/config', async () => ({
    supports_search: false,
    supports_group_request: false,
    supports_marks: false,
    supports_timescale_marks: false,
    supports_time: true,
    supported_resolutions: ['1', '5', '15', '60', 'D', 'W'],
  }));

  fastify.get('/api/v1/tv/symbols', async (req) => {
    const symbol = (req.query as any).symbol || 'NSE:NIFTY';
    const name = symbol.replace('NSE:', '');
    return {
      name: symbol,
      ticker: symbol,
      description: name,
      type: 'index',
      session: '0915-1530',
      timezone: 'Asia/Kolkata',
      exchange: 'NSE',
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      has_daily: true,
    };
  });

  fastify.get('/api/v1/tv/history', async (req, reply) => {
    try {
      const q = req.query as any;
      const symbol = (q.symbol || 'NSE:NIFTY').replace('NSE:', '');
      const resolution = q.resolution || '1';
      const from = parseInt(q.from) || 0;
      const to = parseInt(q.to) || Math.floor(Date.now() / 1000);

      const tfMap: Record<string, string> = { '1': '1m', '5': '5m', '15': '15m', '60': '1h', 'D': '1d', 'W': '1w' };
      const tf = tfMap[resolution] || '1m';
      const limit = Math.min(Math.ceil((to - from) / (parseInt(resolution) * 60)), 500);

      // Read from our candles API
      const container = require('../../container');
      const prisma = container.cradle.prisma;
      const redis2 = container.cradle.redis?.publisher || container.cradle.redis;
      const sym = symbol.toUpperCase();

      let rows: any[] = [];
      // Try Redis first (live CandleBuffer data)
      if (tf === '1m') {
        try {
          const key = `candles:live:${sym}:1m`;
          const raw = await redis2.lRange(key, -limit, -1);
          if (raw?.length) {
            rows = raw.map((r: string) => JSON.parse(r));
          }
        } catch (_) {}
      }
      // Fallback to DB
      if (!rows.length) {
        const tableMap: Record<string, string> = { '1m': 'candles_1m', '5m': 'candles_5m', '15m': 'candles_15m', '1h': 'candles_1h', '1d': 'candles_1d', '1w': 'candles_1d' };
        const table = tableMap[tf] || 'candles_1m';
        try {
          rows = await prisma.$queryRawUnsafe(
            `SELECT time, open, high, low, close, volume FROM ${table} WHERE symbol = $1 AND time BETWEEN to_timestamp($2) AND to_timestamp($3) ORDER BY time ASC LIMIT $4`,
            sym, from, to, limit
          );
        } catch (_) {}
      }

      const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = [];
      for (const row of rows) {
        const ts = row.time ? Math.floor(new Date(row.time).getTime() / 1000) : row.t || 0;
        if (ts < from || ts > to) continue;
        t.push(ts);
        o.push(Number(row.open));
        h.push(Number(row.high));
        l.push(Number(row.low));
        c.push(Number(row.close));
        v.push(Number(row.volume || 0));
      }

      return t.length ? { s: 'ok', t, o, h, l, c, v } : { s: 'no_data', t: [], o: [], h: [], l: [], c: [], v: [] };
    } catch (err) { return { s: 'error', errmsg: (err as any).message }; }
  });
}

module.exports = systemRoutes;
