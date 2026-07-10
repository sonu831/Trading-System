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

  fastify.delete('/api/v1/providers/:id', {
    schema: {
      description: 'Delete a broker provider and its credentials',
      tags: ['Providers'],
    },
    handler: brokerController.deleteProvider,
  });

  fastify.post('/api/v1/providers/:provider/test', {
    schema: {
      description: 'Test broker connection (login + TOTP / OTP / request_token)',
      tags: ['Providers'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            // `additionalProperties: true` is REQUIRED. A bare `{type:'object'}` makes
            // Fastify's serializer strip every key, so the client saw `data: {}` and lost
            // `stage`, `inputType`, `likelyCauses`, `missing`, ... — all the diagnostics.
            data: { type: 'object', additionalProperties: true },
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

  /**
   * Broker auth flows are not all unattended. MStock (without TOTP) mails/SMSes an OTP;
   * Kite returns a single-use `request_token` via a browser redirect. `test` parks the
   * interim state and replies `needs_input`; this finishes the handshake.
   */
  fastify.post('/api/v1/providers/:provider/session/complete', {
    schema: {
      description: 'Complete an interactive broker login (e.g. MStock OTP, Kite request_token)',
      tags: ['Providers'],
      body: {
        type: 'object',
        properties: {
          otp: { type: 'string' },
          request_token: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const result = await brokerSessionService.completeSession(req.params.provider, req.body || {});
        if (result.success) return { success: true, data: result };
        return { success: false, error: result.error, data: result };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });

  /** Lets the dashboard render the right credential form + interactive prompts per broker. */
  fastify.get('/api/v1/broker-strategies', {
    schema: {
      description: 'Supported brokers with their required fields, interactive inputs and capabilities',
      tags: ['Providers'],
    },
    handler: async () => ({ success: true, data: brokerSessionService.listStrategies() }),
  });
}

module.exports = brokerRoutes;
