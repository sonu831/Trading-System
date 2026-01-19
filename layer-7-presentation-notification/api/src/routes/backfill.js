/**
 * Backfill API Routes
 * Handles historical data backfill status and triggering
 */
const db = require('../db/client');
const redis = require('../redis/client');
const { spawn } = require('child_process');
const path = require('path');

// Environment config
const BACKFILL_INTERVAL = process.env.BACKFILL_INTERVAL || 'ONE_MINUTE';
const MAX_DAYS = 30; // Cap at 30 days

/**
 * Get data coverage for all symbols
 * Returns min/max dates per symbol
 */
async function getDataCoverage() {
  const query = `
    SELECT 
      symbol, 
      MIN(timestamp) as earliest,
      MAX(timestamp) as latest,
      COUNT(*) as total_candles
    FROM candlestick_data 
    GROUP BY symbol
    ORDER BY symbol;
  `;

  try {
    const result = await db.query(query);
    return result.rows;
  } catch (e) {
    console.error('DB Error:', e.message);
    return [];
  }
}

/**
 * Get missing date ranges for a symbol
 */
async function getMissingDates(symbol, fromDate, toDate) {
  const query = `
    SELECT date_trunc('day', timestamp)::date as day
    FROM candlestick_data
    WHERE symbol = $1 
      AND timestamp >= $2 
      AND timestamp <= $3
    GROUP BY day
    ORDER BY day;
  `;

  try {
    const result = await db.query(query, [symbol, fromDate, toDate]);
    return result.rows.map((r) => r.day);
  } catch (e) {
    console.error('DB Error:', e.message);
    return [];
  }
}

/**
 * Trigger backfill job
 */
async function triggerBackfill(fromDate, toDate, symbols = null) {
  const jobId = `backfill-${Date.now()}`;

  // Validate date range
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_DAYS) {
    throw new Error(`Date range exceeds ${MAX_DAYS} days limit`);
  }

  // Notify on start via Redis
  try {
    await redis.getClient().publish(
      'backfill:status',
      JSON.stringify({
        type: 'START',
        jobId,
        fromDate,
        toDate,
        symbols: symbols || 'ALL',
        timestamp: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.warn('Redis publish failed:', e.message);
  }

  // Spawn backfill script
  const scriptPath = path.resolve(
    __dirname,
    '../../../../layer-1-ingestion/scripts/batch_nifty50.js'
  );
  const args = ['--from', fromDate, '--to', toDate, '--job-id', jobId];
  if (symbols) {
    args.push('--symbol', symbols);
  }

  const child = spawn('node', [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      BACKFILL_JOB_ID: jobId,
      BACKFILL_INTERVAL,
    },
  });

  child.unref();

  return { jobId, status: 'STARTED', from: fromDate, to: toDate };
}

/**
 * Register routes
 */
async function routes(fastify) {
  // GET /api/backfill/status - Get data coverage
  fastify.get('/api/backfill/status', async (request, reply) => {
    const coverage = await getDataCoverage();
    return {
      status: 'ok',
      interval: BACKFILL_INTERVAL,
      maxDays: MAX_DAYS,
      coverage,
    };
  });

  // POST /api/backfill/trigger - Start backfill job
  fastify.post('/api/backfill/trigger', async (request, reply) => {
    const { fromDate, toDate, symbol } = request.body || {};

    if (!fromDate || !toDate) {
      return reply.status(400).send({ error: 'fromDate and toDate are required' });
    }

    try {
      const result = await triggerBackfill(fromDate, toDate, symbol);
      return { status: 'ok', ...result };
    } catch (e) {
      return reply.status(400).send({ error: e.message });
    }
  });

  // GET /api/backfill/coverage/:symbol - Get coverage for specific symbol
  fastify.get('/api/backfill/coverage/:symbol', async (request, reply) => {
    const { symbol } = request.params;
    const { from, to } = request.query;

    if (!from || !to) {
      return reply.status(400).send({ error: 'from and to query params required' });
    }

    const existingDates = await getMissingDates(symbol, from, to);
    return { symbol, from, to, existingDates };
  });
}

module.exports = routes;
