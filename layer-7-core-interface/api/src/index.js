require('dotenv').config();

// Fix BigInt JSON serialization (required for Prisma BigInt fields)
BigInt.prototype.toJSON = function() {
  return Number(this);
};

const fastify = require('fastify')({
  logger: {
    level: 'info',
    transport: {
      target: 'pino-loki',
      options: {
        host: process.env.LOKI_URL || 'http://loki:3100', // Docker service URL
        labels: { app: 'layer-7-api' },
      },
    },
  },
  ajv: {
    customOptions: {
      strict: false,
      keywords: ['example'],
    },
  },
});
const container = require('./container');
const { waitForAll } = require('/app/shared/health-check');

// Decorate Fastify with DI Container
fastify.decorate('container', container);

// Register Swagger (Docs)
// Register Swagger (Docs)
fastify.register(require('@fastify/swagger'), {
  swagger: {
    info: {
      title: 'Trading System API',
      description: 'Layer 7 Core Interface for Nifty 50 Trading System',
      version: '1.0.0',
    },
    host: 'localhost',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json'],
    securityDefinitions: {
      apiKey: {
        type: 'apiKey',
        name: 'X-API-KEY',
        in: 'header',
      },
    },
  },
});

fastify.register(require('@fastify/swagger-ui'), {
  routePrefix: '/documentation',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

// Redirect /swagger to /documentation for convenience
fastify.get('/swagger', async (req, reply) => {
  return reply.redirect('/documentation');
});
fastify.get('/swagger/index.html', async (req, reply) => {
  return reply.redirect('/documentation');
});

const redis = require('./redis/client');
// const db = require('./db/client'); // REMOVED Legacy DB client

// Register CORS
fastify.register(require('@fastify/cors'), {
  origin: true,
});

// Register WebSocket Plugin (Real-Time)
fastify.register(require('./plugins/websocket'));

// Register Auth & Logging
fastify.register(require('./middleware/AuthMiddleware'));
fastify.register(require('./plugins/logging'));

// Global Auth Hook
fastify.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health' || req.url === '/' || req.url.startsWith('/documentation')) return;

  if (req.url.startsWith('/api/v1')) {
    if (req.headers['x-api-key']) {
      await fastify.authenticate(req, reply);
    }
  }
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

fastify.get('/metrics', async (req, reply) => {
  reply.header('Content-Type', promClient.register.contentType);
  return promClient.register.metrics();
});

fastify.get('/health', async (request, reply) => {
  return { status: 'UP', timestamp: new Date() };
});

// API Routes
// Register Feature Modules
fastify.register(require('./modules/signals/routes'));
fastify.register(require('./modules/system/routes'));
fastify.register(require('./modules/market/routes'));
// fastify.register(require('./modules/data/routes'));
fastify.register(require('./modules/analysis/routes'));

// Suggestions Endpoint (Refactored to Prisma) -> Leaving inline as it belongs to User Domain (next phase)
fastify.post('/api/v1/suggestions', async (req, reply) => {
  const { user, text, source } = req.body;
  if (!text) return reply.code(400).send({ error: 'Text is required' });

  try {
    const { prisma } = container.cradle;
    await prisma.user_suggestions.create({
      data: {
        username: user || 'Anonymous',
        message: text,
        source: source || 'telegram',
        created_at: new Date(),
      },
    });

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

// Email Subscriptions Endpoint (Refactored to Prisma)
fastify.post('/api/v1/subscribers', async (req, reply) => {
  const { chatId, username, email } = req.body;
  if (!chatId || !email) return reply.code(400).send({ error: 'ChatID and Email are required' });

  try {
    const { prisma } = container.cradle;
    // Upsert logic
    await prisma.user_subscribers.upsert({
      where: { chat_id: chatId.toString() },
      update: { email, username, is_active: true },
      create: {
        chat_id: chatId.toString(),
        username: username || 'Anonymous',
        email,
        subscribed_at: new Date(),
        is_active: true,
      },
    });
    return { success: true, message: 'Subscribed successfully' };
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

const start = async () => {
  try {
    // Wait for Infrastructure Dependencies
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const timescaleUrl = process.env.TIMESCALE_URL || 'postgresql://user:pass@timescaledb:5432/db';

    // Initialize metrics with Global Registry (used by fastify-metrics/prom-client)
    const { initHealthMetrics } = require('/app/shared/health-check');
    initHealthMetrics(promClient.register);

    await waitForAll({
      redis: { url: redisUrl },
      timescale: { connectionString: timescaleUrl },
    }, { logger: fastify.log });

    await redis.connect();
    // DB Schema Init via Prisma Migration usually, but we check connection
    // Prisma client connects lazily or on first request.

    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
async function shutdown() {
  fastify.log.info('Shutting down Layer 7...');
  try {
    await fastify.close();
    await redis.disconnect();
  } catch (err) {
    fastify.log.error(err, 'Shutdown error');
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
