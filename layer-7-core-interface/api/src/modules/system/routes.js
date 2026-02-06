const { systemStatusSchema, backfillTriggerSchema } = require('./schemas');

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
  // BACKFILL MANAGEMENT
  // ─────────────────────────────────────────────────────────────
  fastify.post('/api/v1/system/backfill/trigger', {
    schema: backfillTriggerSchema,
    handler: systemController.triggerBackfill,
  });

  fastify.get('/api/v1/system/backfill/swarm/status', {
    handler: systemController.getSwarmStatus,
  });

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
}

module.exports = systemRoutes;
