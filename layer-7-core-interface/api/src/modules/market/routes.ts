const { marketViewSchema } = require('./schemas');

/**
 * Market Routes
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function marketRoutes(fastify, options) {
  const container = require('../../container');
  const marketController = container.resolve('marketController');

  fastify.get('/api/v1/market-view', {
    schema: marketViewSchema,
    handler: marketController.getMarketView,
  });
}

module.exports = marketRoutes;
