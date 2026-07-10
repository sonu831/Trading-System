const { getSignalsSchema } = require('./schemas');

/**
 * Signal Routes
 * @param {FastifyInstance} fastify
 * @param {Object} options
 */
async function signalRoutes(fastify, options) {
  const container = require('../../container'); // Access DI container
  const signalController = container.resolve('signalController');

  fastify.get('/api/v1/signals', {
    schema: getSignalsSchema,
    handler: signalController.getSignals, // Bind to the instance method
  });
}

module.exports = signalRoutes;
