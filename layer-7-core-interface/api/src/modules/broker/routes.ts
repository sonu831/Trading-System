const { providerListSchema, credentialSaveSchema } = require('./schemas');

async function brokerRoutes(fastify, options) {
  const container = require('../../container');
  const brokerController = container.resolve('brokerController');
  const brokerSessionService = container.resolve('brokerSessionService');
  const brokerService = container.resolve('brokerService');

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
  // ─────────────────────────────────────────────────────────────
  // TOTP — generate the current code from the stored secret.
  //
  // Enrolling TOTP on the broker's portal requires you to prove you hold the secret by
  // submitting a live code. Without this the operator has to run an authenticator app on the
  // side, which is how a 6-digit CODE ended up saved in the `totp_secret` field: a code expires
  // in 30s, so unattended auth could never work and MStock 401'd every call.
  //
  // Returns the derived code only — never the secret.
  // ─────────────────────────────────────────────────────────────
  fastify.get('/api/v1/providers/:provider/totp', {
    schema: {
      description: 'Current TOTP code derived from the stored secret (for enrolling on the broker portal)',
      tags: ['Providers'],
    },
    handler: async (req, reply) => {
      try {
        const { provider } = req.params as { provider: string };
        const brokerService = require('../../container').resolve('brokerService') as any;
        const creds = await brokerService.getDecryptedCredentials(provider);

        if (!creds?.totp_secret) {
          return reply.code(404).send({ success: false, error: 'No totp_secret stored for this provider' });
        }

        // Throws with an actionable message if the stored value is a 6-digit code or otherwise
        // not Base32 — we never silently emit a wrong code (rule 11).
        const code = brokerSessionService.deps.generateTOTP(creds.totp_secret);

        const period = 30;
        const expiresIn = period - (Math.floor(Date.now() / 1000) % period);
        return { success: true, data: { code, period, expiresIn } };
      } catch (err: any) {
        return reply.code(400).send({ success: false, error: err.message, stage: 'totp_secret' });
      }
    },
  });

  // Session metadata for the dashboard: the token + when it dies. Deliberately does NOT return
  // credentials (unlike /session, which ingestion uses).
  fastify.get('/api/v1/providers/:provider/session/info', {
    schema: {
      description: 'Session token + expiry for the dashboard (no credentials)',
      tags: ['Providers'],
    },
    handler: async (req, reply) => {
      try {
        const { provider } = req.params as { provider: string };
        const brokerService = require('../../container').resolve('brokerService') as any;
        const raw = await brokerService.getJson(`broker:session:${provider}`);
        const token = await brokerSessionService.getCachedToken(provider);

        if (!token) {
          // Not an error — it is the honest "not logged in yet" state.
          return { success: true, data: { connected: false, jwt: null, expiresAt: null } };
        }
        const expiresAt = (raw as any)?.expiresAt ?? null;
        return {
          success: true,
          data: {
            connected: true,
            jwt: token,
            expiresAt,
            expiresInSeconds: expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : null,
          },
        };
      } catch (err: any) {
        return reply.code(500).send({ success: false, error: err.message });
      }
    },
  });

  fastify.get('/api/v1/providers/:provider/session', {
    schema: {
      description: 'Return session token + decrypted credentials for ingestion',
      tags: ['Providers'],
    },
    handler: async (req, reply) => {
      try {
        const { provider } = req.params as { provider: string };
        const brokerService = require('../../container').resolve('brokerService') as any;

        // Auto-refresh unattended tokens — ingestion/L1 must never receive an expired/null
        // token when the broker strategy supports unattended auth (TOTP secret present).
        const token = await brokerSessionService.getOrRefreshToken(provider);
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

  // ─────────────────────────────────────────────────────────────
  // MARKET DATA — live quotes, option chain via broker SDK adapters
  // ─────────────────────────────────────────────────────────────

  /** Helper: get an authenticated MStock adapter with cached JWT token and API key from DB. */
  async function getAuthAdapter() {
    const { getAdapter } = require('./adapters');
    const creds = await brokerService.getDecryptedCredentials('mstock');
    if (!creds?.api_key) throw new Error('MStock API key not configured. Save credentials first.');
    const adapter = getAdapter('mstock', creds.api_key);
    if (!adapter) throw new Error('MStock adapter not available');
    const redis = require('redis').createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
    await redis.connect();
    const raw = await redis.get('broker:session:mstock');
    await redis.disconnect();
    const jwt = raw ? JSON.parse(raw)?.token : null;
    if (!jwt) throw new Error('No session token. Run Test Connection in dashboard first.');
    adapter.setAccessToken(jwt);
    return adapter;
  }

  const INDEX_TOKENS: Record<string, string> = {
    NIFTY: '26000', BANKNIFTY: '26009', FINNIFTY: '26037', MIDCPNIFTY: '26074',
  };

  fastify.get('/api/v1/market/index', {
    schema: {
      description: 'Live index quote (NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY)',
      tags: ['Market Data'],
      querystring: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string' } } },
    },
    handler: async (req, reply) => {
      try {
        const sym = (req.query as any).symbol?.toUpperCase();
        const token = INDEX_TOKENS[sym];
        if (!token) return { success: false, error: `Unknown index. Use: ${Object.keys(INDEX_TOKENS).join(', ')}` };
        const adapter = await getAuthAdapter();
        const result = await adapter.getQuote({ mode: 'LTP', exchangeTokens: { NSE: [token] } });
        return { success: true, data: result.data || result };
      } catch (e: any) { return { success: false, error: e.message }; }
    },
  });

  fastify.get('/api/v1/market/option-chain', {
    schema: {
      description: 'Option chain for an underlying index',
      tags: ['Market Data'],
      querystring: {
        type: 'object', required: ['underlying', 'expiry'],
        properties: { underlying: { type: 'string' }, expiry: { type: 'string' }, strike: { type: 'number' } },
      },
    },
    handler: async (req, reply) => {
      try {
        const q = req.query as any;
        const adapter = await getAuthAdapter();
        const params: OptionChainParams = { underlying: q.underlying.toUpperCase(), expiry: q.expiry };
        if (q.strike) params.strike = Number(q.strike);
        const result = await adapter.getOptionChain(params);
        return { success: true, data: result.data || result };
      } catch (e: any) { return { success: false, error: e.message }; }
    },
  });

  fastify.get('/api/v1/market/quotes', {
    schema: {
      description: 'Live quotes for equity symbols',
      tags: ['Market Data'],
      querystring: {
        type: 'object', required: ['symbols'],
        properties: { symbols: { type: 'string' } },
      },
    },
    handler: async (req, reply) => {
      try {
        const syms = (req.query as any).symbols.split(',').map((s: string) => s.trim().toUpperCase());
        // Resolve symbols → MStock tokens from master map
        let masterMap: any[] = [];
        try { masterMap = require('/app/vendor/nifty50_shared.json'); } catch (_) { /* fallthrough */ }
        const tokens: string[] = [];
        for (const sym of syms) {
          const entry = masterMap.find((m: any) => m.symbol?.toUpperCase() === sym);
          if (entry?.tokens?.mstock) tokens.push(entry.tokens.mstock);
        }
        if (!tokens.length) return { success: false, error: 'No valid tokens found for requested symbols' };
        const adapter = await getAuthAdapter();
        const result = await adapter.getQuote({ mode: 'FULL', exchangeTokens: { NSE: tokens } });
        return { success: true, data: result.data || result };
      } catch (e: any) { return { success: false, error: e.message }; }
    },
  });

  fastify.get('/api/v1/market/positions', {
    schema: { description: 'Get MStock open positions', tags: ['Market Data'] },
    handler: async (req, reply) => {
      try {
        const adapter = await getAuthAdapter();
        const result = await adapter.getPositions();
        return { success: true, data: result.data || result };
      } catch (e: any) { return { success: false, error: e.message }; }
    },
  });

  fastify.get('/api/v1/market/holdings', {
    schema: { description: 'Get MStock holdings', tags: ['Market Data'] },
    handler: async (req, reply) => {
      try {
        const adapter = await getAuthAdapter();
        const result = await adapter.getHoldings();
        return { success: true, data: result.data || result };
      } catch (e: any) { return { success: false, error: e.message }; }
    },
  });
}

module.exports = brokerRoutes;
