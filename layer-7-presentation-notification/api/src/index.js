const fastify = require('fastify')({ logger: true });
const redis = require('./redis/client');
const db = require('./db/client');

// Register CORS
// Note: fastify-cors v6 usage
fastify.register(require('@fastify/cors'), {
  origin: true, // Allow all for dev
});

// Register backfill routes
fastify.register(require('./routes/backfill'));

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
    } catch {
      /* ignore */
    }

    let candleCount = 0;
    try {
      const res = await db.query('SELECT count(*) FROM candles_1m');
      candleCount = parseInt(res.rows[0].count);
    } catch {
      /* ignore */
    }

    const logs = await redis.getList('system:layer1:logs', 0, 49);

    const l1 = (await getMetric('system:layer1:metrics')) || {
      type: 'Stream',
      source: 'MStock',
      status: 'Unknown',
    };
    const l2 = (await getMetric('system:layer2:metrics')) || { status: 'Unknown' };
    const l4 = (await getMetric('system:layer4:metrics')) || { status: 'Unknown' };
    const l5 = (await getMetric('system:layer5:metrics')) || { status: 'Unknown' };
    const l6 = (await getMetric('system:layer6:metrics')) || { status: 'Unknown' };
    const l7 = (await getMetric('layer7_api_http_request_duration_seconds')) || {
      status: 'Unknown',
    };

    return {
      layers: {
        layer1: {
          name: 'Ingestion',
          status: 'ONLINE',
          metrics: l1,
          backfill: await getMetric('system:layer1:backfill'),
          logs,
        },
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
        params: request.body, // Pass { fromDate, toDate, symbol }
        timestamp: Date.now(),
      })
    );
    return { message: 'Backfill triggered successfully' };
  } catch (err) {
    reply.code(500).send({ error: 'Failed to trigger backfill', message: err.message });
  }
});

// Suggestions Endpoint
fastify.post('/api/v1/suggestions', async (req, reply) => {
  const { user, text, source } = req.body;
  if (!text) return reply.code(400).send({ error: 'Text is required' });

  try {
    await db.query(
      'INSERT INTO user_suggestions (username, message, source, created_at) VALUES ($1, $2, $3, NOW())',
      [user || 'Anonymous', text, source || 'telegram']
    );

    // Publish event for Consumers (Email Service)
    const payload = JSON.stringify({
      user: user || 'Anonymous',
      text,
      source: source || 'telegram',
    });
    await redis.publisher.publish('notifications:suggestions', payload);

    return { success: true, message: 'Suggestion saved' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

// Email Subscriptions Endpoint
fastify.post('/api/v1/subscribers', async (req, reply) => {
  const { chatId, username, email } = req.body;
  if (!chatId || !email) return reply.code(400).send({ error: 'ChatID and Email are required' });

  try {
    await db.query(
      `INSERT INTO user_subscribers (chat_id, username, email, subscribed_at) 
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (chat_id) DO UPDATE SET email = EXCLUDED.email, username = EXCLUDED.username, is_active = TRUE`,
      [chatId.toString(), username || 'Anonymous', email]
    );
    return { success: true, message: 'Subscribed successfully' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

// Start Server
const start = async () => {
  try {
    await redis.connect();
    // Initialize DB Schema
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_suggestions (
        id SERIAL PRIMARY KEY,
        username TEXT,
        message TEXT NOT NULL,
        source TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS user_subscribers (
        id SERIAL PRIMARY KEY,
        chat_id TEXT UNIQUE NOT NULL,
        username TEXT,
        email TEXT UNIQUE NOT NULL,
        subscribed_at TIMESTAMPTZ DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
