const { systemStatusSchema, backfillTriggerSchema } = require('./schemas');

/**
 * System Routes
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function systemRoutes(fastify, options) {
  const container = require('../../container');
  const systemController = container.resolve('systemController');

  fastify.get('/api/v1/system-status', {
    schema: systemStatusSchema,
    handler: systemController.getSystemStatus,
  });

  fastify.post('/api/v1/system/backfill/trigger', {
    schema: backfillTriggerSchema,
    handler: systemController.triggerBackfill,
  });

  const healthController = require('./health.controller');
  fastify.get('/api/v1/health/detailed', healthController.getDetailedHealth);

  const newsController = require('./news.controller');
  fastify.get('/api/v1/news', newsController.getNews);
}

module.exports = systemRoutes;
