const {
  executionStateSchema,
  killSchema,
  resumeSchema,
  squareOffSchema,
} = require('./schemas');

/**
 * Execution Routes — proxy onto Layer 10.
 * @param {FastifyInstance} fastify
 */
async function executionRoutes(fastify, options) {
  const container = require('../../container');
  const executionController = container.resolve('executionController');

  fastify.get('/api/v1/execution/state', {
    schema: executionStateSchema,
    handler: executionController.getState,
  });

  fastify.post('/api/v1/execution/kill', {
    schema: killSchema,
    handler: executionController.kill,
  });

  fastify.post('/api/v1/execution/resume', {
    schema: resumeSchema,
    handler: executionController.resume,
  });

  fastify.post('/api/v1/execution/square-off', {
    schema: squareOffSchema,
    handler: executionController.squareOff,
  });

  // ─────────────────────────────────────────────────────────────
  // STRIKE PREVIEW — what the engine would do right now
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/execution/strike-preview', {
    schema: {
      description: 'Engine intent: strike, premium, lots, SL, risk for a given signal direction',
      tags: ['Execution'],
      querystring: {
        type: 'object',
        properties: {
          underlying: { type: 'string', default: 'NIFTY' },
          direction: { type: 'string', enum: ['LONG', 'SHORT'], default: 'LONG' },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const container = require('../../container');
        const { redis } = container.cradle;
        const u = (req.query.underlying || 'NIFTY').toUpperCase();
        const dir = req.query.direction || 'LONG';
        const step = u === 'BANKNIFTY' ? 100 : 50;
        const lotSize = u === 'BANKNIFTY' ? 15 : 25;
        const capital = 25000;  // ₹ risk envelope
        const maxRiskPrc = 0.02; // 2% per trade

        // Spot price
        const sr = await redis.get(`ltp:${u}`);
        const s = sr ? (typeof sr === 'string' ? JSON.parse(sr) : sr) : null;
        const spot = s?.price || s?.close || 0;
        if (!spot) return { success: true, data: { error: 'No spot price available' } };

        const atm = Math.round(spot / step) * step;
        const strike = dir === 'LONG' ? atm - step : atm + step; // ITM-1

        // Build NFO symbol
        const m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
        const IST = 5.5 * 3600000;
        const now = new Date(Date.now() + IST);
        const today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const nextThu = new Date(today);
        nextThu.setDate(nextThu.getDate() + (4 - nextThu.getDay() + 7) % 7);
        const yy = String(nextThu.getUTCFullYear()).slice(2);
        const mm = m[nextThu.getUTCMonth()];
        const dd = String(nextThu.getUTCDate()).padStart(2, '0');
        const expiryCode = `${dd}${mm}${yy}`;
        const optionType = dir === 'LONG' ? 'CE' : 'PE';
        const nfoSymbol = `${u}${expiryCode}${strike}${optionType}`;

        // Premium estimate (from Redis if available)
        let premium = 0;
        try {
          const pKey = `ltp:${nfoSymbol}`;
          const pr = await redis.get(pKey);
          if (pr) { const pd = typeof pr === 'string' ? JSON.parse(pr) : pr; premium = pd?.price || pd?.ltp || 0; }
        } catch (_) {}
        if (premium <= 0) premium = spot * 0.008; // ~0.8% of spot as estimate

        // Position sizing
        const riskPerLot = premium * lotSize * 0.18; // 18% SL
        const maxLots = Math.floor(capital * maxRiskPrc / riskPerLot);
        const lots = Math.max(1, Math.min(maxLots, 1)); // max 1 lot for safety
        const quantity = lots * lotSize;
        const slPrice = dir === 'LONG' ? premium * 0.82 : premium * 1.18;
        const targetPrice = dir === 'LONG' ? premium * 1.25 : premium * 0.75;
        const risk = Math.abs(premium - slPrice) * quantity;
        const reward = Math.abs(targetPrice - premium) * quantity;

        return {
          success: true,
          data: {
            underlying: u, direction: dir, spot, atm, strike, moneyness: dir === 'LONG' ? 'ITM-1' : 'ITM-1',
            nfoSymbol, optionType, expiry: nextThu.toISOString().split('T')[0],
            premium, lots, quantity, lotSize,
            slPrice, targetPrice, risk: Math.round(risk), reward: Math.round(reward),
            riskReward: reward / risk,
          },
        };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });
}

module.exports = executionRoutes;
