async function analysisRoutes(fastify, options) {
  const container = require('../../container');
  const analysisController = container.resolve('analysisController');

  fastify.get('/api/v1/analyze', {
    handler: analysisController.getAnalysis,
  });

  fastify.get('/api/v1/analyze/market', {
    handler: analysisController.getMarketAnalysis,
  });
}

module.exports = analysisRoutes;
