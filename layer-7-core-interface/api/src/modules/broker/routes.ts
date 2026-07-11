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

  fastify.post('/api/v1/providers/:id/credentials/bulk', {
    schema: {
      description: 'Bulk save/delete credentials in one request',
      tags: ['Providers'],
      body: {
        type: 'object',
        required: ['credentials'],
        properties: {
          credentials: {
            type: 'array',
            items: {
              type: 'object',
              required: ['field_name', 'field_value'],
              properties: {
                field_name: { type: 'string', enum: ['api_key', 'api_secret', 'client_code', 'password', 'totp_secret', 'access_token'] },
                field_value: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: brokerController.saveCredentials,
  });

  fastify.delete('/api/v1/providers/:id/credentials', {
    schema: {
      description: 'Delete a single credential field from a provider',
      tags: ['Providers'],
    },
    handler: brokerController.deleteCredential,
  });

  fastify.get('/api/v1/providers/:provider/credentials/decrypted', {
    schema: {
      description: 'Return fully decrypted credentials (internal use — dashboard + execution engine)',
      tags: ['Providers'],
    },
    handler: async (req, reply) => {
      try {
        const { provider } = req.params as { provider: string };
        const brokerRepo = (require('../../container').resolve('brokerRepository') as any);
        const p = await brokerRepo.findProviderByName(provider);
        if (!p) return reply.code(404).send({ success: false, error: 'Provider not found' });
        if (!p.enabled) return reply.code(403).send({ success: false, error: 'Provider disabled' });
        const creds = await (require('../../container').resolve('brokerService') as any).getDecryptedCredentials(provider);
        return { success: true, data: { provider, role: p.role, priority: p.priority, credentials: creds } };
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    },
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

  /**
   * Get the active JWT session token + decrypted credentials for a provider.
   * The ingestion layer reads this (NOT Redis directly) for MStock WebSocket + REST auth.
   */
  fastify.get('/api/v1/providers/:provider/session', {
    schema: {
      description: 'Return session token + decrypted credentials for ingestion',
      tags: ['Providers'],
    },
    handler: async (req, reply) => {
      try {
        const { provider } = req.params as { provider: string };
        const brokerService = require('../../container').resolve('brokerService') as any;
        const token = await brokerService.getSessionToken(provider);
        const creds = await brokerService.getDecryptedCredentials(provider);
        return { success: true, data: { session_token: token, credentials: creds } };
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    },
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
        // Return updated provider data so the dashboard can show CONNECTED/DISCONNECTED immediately
        const brokerRepo = (require('../../container').resolve('brokerRepository') as any);
        const p = await brokerRepo.findProviderByName(req.params.provider);
        if (result.success) {
          return { success: true, data: result, provider: p ? { id: p.id, status: p.status, last_tested_at: p.last_tested_at } : null };
        }
        return { success: false, error: result.error, data: result, provider: p ? { id: p.id, status: p.status, last_tested_at: p.last_tested_at } : null };
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
          totp: { type: 'string' },   // direct 6-digit TOTP code for MStock one-step login
          request_token: { type: 'string' },
        },
      },
    },
    handler: async (req, reply) => {
      try {
        const result = await brokerSessionService.completeSession(req.params.provider, req.body || {});
        const brokerRepo = (require('../../container').resolve('brokerRepository') as any);
        const p = await brokerRepo.findProviderByName(req.params.provider);
        if (result.success) return { success: true, data: result, provider: p ? { id: p.id, status: p.status, last_tested_at: p.last_tested_at } : null };
        return { success: false, error: result.error, data: result, provider: p ? { id: p.id, status: p.status, last_tested_at: p.last_tested_at } : null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },
  });

  /** Lets the dashboard render the right credential form + interactive prompts per broker.
   *  Also returns shared enums so the UI always stays in sync with backend. */
  fastify.get('/api/v1/broker-strategies', {
    schema: {
      description: 'Supported brokers, form fields, capabilities, shared constants',
      tags: ['Providers'],
    },
    handler: async () => {
      const strategies = brokerSessionService.listStrategies();
      const shared = require('../../../shared/constants');
      return {
        success: true,
        data: strategies,
        meta: {
          providers: shared.BROKER_PROVIDERS || [
            { value: 'mstock', label: 'mStock (Mirae Asset)' },
            { value: 'flattrade', label: 'FlatTrade' },
            { value: 'kite', label: 'Zerodha Kite' },
            { value: 'indianapi', label: 'IndianAPI' },
          ],
          roles: ['data', 'execution', 'both'],
          credentialFields: shared.BROKER_CREDENTIAL_FIELDS || ['api_key', 'api_secret', 'client_code', 'password', 'totp_secret', 'access_token'],
          formFields: shared.BROKER_FORM_FIELDS || {},
        },
      };
    },
  });
}

module.exports = brokerRoutes;
