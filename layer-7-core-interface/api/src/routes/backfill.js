/**
 * Backfill API Routes
 * Handles historical data backfill status and triggering
 */
/**
 * Backfill API Routes
 * Handles historical data backfill status and triggering
 */
const { spawn } = require('child_process');
const path = require('path');

// Environment config
const BACKFILL_INTERVAL = process.env.BACKFILL_INTERVAL || 'ONE_MINUTE';
const MAX_DAYS = 30; // Cap at 30 days

/**
 * Get data coverage for all symbols
 */
async function getDataCoverage(prisma) {
  try {
    const results = await prisma.candles_1m.groupBy({
      by: ['symbol'],
      _min: { time: true },
      _max: { time: true },
      _count: { _all: true },
      orderBy: { symbol: 'asc' },
    });

    return results.map((r) => ({
      symbol: r.symbol,
      earliest: r._min.time,
      latest: r._max.time,
      total_candles: Number(r._count._all), // BigInt to Number
    }));
  } catch (e) {
    console.error('DB Error:', e.message);
    return [];
  }
}

/**
 * Get missing date ranges for a symbol
 */
async function getMissingDates(prisma, symbol, fromDate, toDate) {
  try {
    // Histogram query using time_bucket or date_trunc on hypertable
    const result = await prisma.$queryRaw`
      SELECT date_trunc('day', time)::date as day
      FROM candles_1m
      WHERE symbol = ${symbol}
        AND time >= ${new Date(fromDate)} 
        AND time <= ${new Date(toDate)}
      GROUP BY day
      ORDER BY day ASC
    `;
    return result.map((r) => r.day);
  } catch (e) {
    console.error('DB Error:', e.message);
    return [];
  }
}

/**
 * Trigger backfill job
 */
async function triggerBackfill(redis, fromDate, toDate, symbols = null) {
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
    // Container redis client has .publish method directly if it's node-redis v4
    await redis.publish(
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
    stdio: 'ignore', // Detach completely
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
  const { prisma, redis } = fastify.container.cradle;

  // GET /api/backfill/status - Get data coverage
  fastify.get('/api/backfill/status', async (request, reply) => {
    const coverage = await getDataCoverage(prisma);
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
      const result = await triggerBackfill(redis, fromDate, toDate, symbol);
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

    const existingDates = await getMissingDates(prisma, symbol, from, to);
    return { symbol, from, to, existingDates };
  });
}

module.exports = routes;
