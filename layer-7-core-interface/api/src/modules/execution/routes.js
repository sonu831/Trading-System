const {
  executionStateSchema,
  killSchema,
  resumeSchema,
  squareOffSchema,
} = require('./schemas');

/**
 * Execution Routes — proxy onto Layer 10.
 * @param {FastifyInstance} fastify
 */
async function executionRoutes(fastify, options) {
  const container = require('../../container');
  const executionController = container.resolve('executionController');

  fastify.get('/api/v1/execution/state', {
    schema: executionStateSchema,
    handler: executionController.getState,
  });

  fastify.post('/api/v1/execution/kill', {
    schema: killSchema,
    handler: executionController.kill,
  });

  fastify.post('/api/v1/execution/resume', {
    schema: resumeSchema,
    handler: executionController.resume,
  });

  fastify.post('/api/v1/execution/square-off', {
    schema: squareOffSchema,
    handler: executionController.squareOff,
  });
}

module.exports = executionRoutes;
