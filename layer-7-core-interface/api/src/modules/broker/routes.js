const { providerListSchema, credentialSaveSchema } = require('./schemas');

async function brokerRoutes(fastify, options) {
  const container = require('../../container');
  const brokerController = container.resolve('brokerController');
  const brokerSessionService = container.resolve('brokerSessionService');

  fastify.get('/api/v1/providers', {
    schema: providerListSchema,
    handler: brokerController.listProviders,
  });

  fastify.post('/api/v1/providers', {
    schema: {
      description: 'Register a new broker provider',
      tags: ['Providers'],
      body: {
        type: 'object',
        required: ['provider'],
        properties: {
          provider: { type: 'string', enum: ['mstock', 'flattrade', 'kite', 'indianapi'] },
          role: { type: 'string', enum: ['data', 'execution', 'both'], default: 'data' },
          priority: { type: 'integer', default: 1 },
          enabled: { type: 'boolean', default: false },
        },
      },
    },
    handler: brokerController.createProvider,
  });

  fastify.get('/api/v1/providers/:id', {
    handler: brokerController.getProvider,
  });

  fastify.patch('/api/v1/providers/:id', {
    schema: {
      description: 'Update provider config (role, priority, enabled)',
      tags: ['Providers'],
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', enum: ['data', 'execution', 'both'] },
          priority: { type: 'integer' },
          enabled: { type: 'boolean' },
        },
      },
    },
    handler: brokerController.updateProvider,
  });

  fastify.post('/api/v1/providers/:id/enable', {
    handler: brokerController.enableProvider,
  });

  fastify.post('/api/v1/providers/:id/disable', {
    handler: brokerController.disableProvider,
  });

  fastify.post('/api/v1/providers/:id/credentials', {
    schema: credentialSaveSchema,
    handler: brokerController.saveCredential,
  });

  fastify.get('/api/v1/providers/:provider/status', {
    handler: brokerController.getProviderStatus,
  });

  fastify.post('/api/v1/providers/:provider/test', {
    schema: {
      description: 'Test broker connection (login + TOTP)',
      tags: ['Providers'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const result = await brokerSessionService.testConnection(req.params.provider);
        if (result.success) {
          return { success: true, data: result };
        }
        return { success: false, error: result.error, data: result };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });
}

module.exports = brokerRoutes;
