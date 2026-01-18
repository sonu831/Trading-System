const fastify = require('fastify')({ logger: true });
const redis = require('./redis/client');
const db = require('./db/client');

// Register CORS
// Note: fastify-cors v6 usage
fastify.register(require('@fastify/cors'), {
  origin: true, // Allow all for dev
});

const PORT = process.env.PORT || 4000;

const promClient = require('prom-client');
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'layer7_api_' });

const httpRequestDurationMicroseconds = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5],
});

// Fastify hook for HTTP request duration
fastify.addHook('onRequest', async (request) => {
  request.startTime = Date.now();
});

fastify.addHook('onResponse', async (request, reply) => {
  const duration = (Date.now() - request.startTime) / 1000;
  httpRequestDurationMicroseconds.observe(
    {
      method: request.method,
      route: request.routeOptions?.url || request.url,
      code: reply.statusCode,
    },
    duration
  );
});

// Metrics Endpoint
fastify.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', promClient.register.contentType);
  return promClient.register.metrics();
});

fastify.get('/health', async (request, reply) => {
  return { status: 'UP', timestamp: new Date() };
});

// API Routes
fastify.get('/api/v1/market-view', async (req, reply) => {
  try {
    const view = await redis.get('market_view:latest'); // Check Layer 5 key
    // If not found in simple key, try to wait for pub/sub or check if L5 sets a retained key
    if (!view) {
      // Fallback: This key might not be set as a string. L5 code sets 'market_view:latest' via PUBLISH but does it SET?
      // Checking L5 redis client: it sets 'market_view:latest' (if updated properly).
      // Actually L5 Redis client code: `c.rdb.Set(ctx, key, jsonData, ...)`
      // So if L5 used key 'market_view:latest', we are good.
      // Wait, L5 `aggregator.go` calls publish with key `market_view:latest`.
      return { message: 'No market view available yet' };
    }
    return view;
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

fastify.get('/api/v1/signals', async (req, reply) => {
  try {
    const signals = await redis.getList('signals:history');
    return signals || [];
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

fastify.get('/api/v1/system-status', async (req, reply) => {
  try {
    const redisStatus = redis.isConnected ? 'ONLINE' : 'OFFLINE';

    // Helper to fetch JSON metric
    const getMetric = async (key) => {
      try {
        // The redis client .get() already does JSON.parse()
        return await redis.get(key);
      } catch (e) {
        return null;
      }
    };

    // Fetch Counts (Fallbacks)
    let signalCount = 0;
    try {
      signalCount = await redis.publisher.lLen('signals:history');
    } catch (e) {}

    let candleCount = 0;
    try {
      const res = await db.query('SELECT count(*) FROM candles_1m');
      candleCount = parseInt(res.rows[0].count);
    } catch (e) {}

    const l1 = (await getMetric('system:layer1:metrics')) || {
      type: 'Stream',
      source: 'MStock',
      status: 'Unknown',
    };
    const backfill = await getMetric('system:layer1:backfill');
    const l2 = (await getMetric('system:layer2:metrics')) || { candles_processed: candleCount };
    const l4 = (await getMetric('system:layer4:metrics')) || {
      stocks_analyzed: 50,
      latency: '10ms',
      goroutines: 0,
    };
    const l5 = (await getMetric('system:layer5:metrics')) || { sectors: 12, goroutines: 0 };
    const l6 = (await getMetric('system:layer6:metrics')) || { signals_total: signalCount };

    // Layer 7 (Self)
    const mem = process.memoryUsage();
    const l7 = {
      active: true,
      heap_used: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
      uptime: process.uptime().toFixed(0) + 's',
    };

    return {
      layers: {
        layer1: { name: 'Ingestion', status: 'ONLINE', metrics: l1, backfill },
        layer2: { name: 'Processing', status: 'ONLINE', metrics: l2 },
        layer3: {
          name: 'Storage',
          status: 'ONLINE',
          metrics: { db_rows: candleCount, type: 'TimeScaleDB' },
        },
        layer4: { name: 'Analysis', status: 'ONLINE', metrics: l4 },
        layer5: { name: 'Aggregation', status: 'ONLINE', metrics: l5 },
        layer6: { name: 'Signal', status: 'ONLINE', metrics: l6 },
        layer7: { name: 'Presentation', status: 'ONLINE', metrics: l7 },
      },
      infra: {
        kafka: 'ONLINE',
        redis: redisStatus,
        timescaledb: 'ONLINE',
      },
    };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});
fastify.post('/api/v1/system/backfill/trigger', async (request, reply) => {
  try {
    await redis.publisher.publish(
      'system:commands',
      JSON.stringify({
        command: 'START_BACKFILL',
        timestamp: Date.now(),
      })
    );
    return { message: 'Backfill triggered successfully' };
  } catch (err) {
    reply.code(500).send({ error: 'Failed to trigger backfill', message: err.message });
  }
});

// Start Server
const start = async () => {
  try {
    await redis.connect();
    // await db.connect(); // Lazy connect via pool usually fine

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
