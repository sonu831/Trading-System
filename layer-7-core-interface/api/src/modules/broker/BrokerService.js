const BaseService = require('../../common/services/BaseService');
const { encrypt, decrypt, maskValue } = require('../../utils/crypto');

class BrokerService extends BaseService {
  constructor({ brokerRepository }) {
    super({ repository: brokerRepository });
    this.brokerRepository = brokerRepository;
  }

  async listProviders() {
    const providers = await this.brokerRepository.findAllProviders();
    return providers.map((p) => ({
      id: p.id,
      provider: p.provider,
      enabled: p.enabled,
      role: p.role,
      priority: p.priority,
      status: p.status,
      last_tested_at: p.last_tested_at,
      credentials: (p.credentials || []).map((c) => ({ field_name: c.field_name, is_active: c.is_active })),
      created_at: p.created_at,
      updated_at: p.updated_at,
    }));
  }

  async getProvider(id) {
    const provider = await this.brokerRepository.findProviderById(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.statusCode = 404;
      throw err;
    }
    return {
      id: provider.id,
      provider: provider.provider,
      enabled: provider.enabled,
      role: provider.role,
      priority: provider.priority,
      status: provider.status,
      last_tested_at: provider.last_tested_at,
      credentials: provider.credentials.map((c) => ({ field_name: c.field_name, value: maskValue(decrypt(c.ciphertext, c.iv, c.tag)) })),
      created_at: provider.created_at,
      updated_at: provider.updated_at,
    };
  }

  async createProvider(data) {
    const existing = await this.brokerRepository.findProviderByName(data.provider);
    if (existing) {
      const err = new Error(`Provider "${data.provider}" already exists`);
      err.statusCode = 409;
      throw err;
    }
    return this.brokerRepository.createProvider({
      provider: data.provider,
      role: data.role || 'data',
      priority: data.priority || 1,
      enabled: data.enabled !== undefined ? data.enabled : false,
    });
  }

  async updateProvider(id, data) {
    const provider = await this.brokerRepository.findProviderById(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.statusCode = 404;
      throw err;
    }
    return this.brokerRepository.updateProvider(id, {
      role: data.role || provider.role,
      priority: data.priority !== undefined ? data.priority : provider.priority,
      enabled: data.enabled !== undefined ? data.enabled : provider.enabled,
      updated_at: new Date(),
    });
  }

  async saveCredential(providerId, fieldName, fieldValue) {
    const provider = await this.brokerRepository.findProviderById(providerId);
    if (!provider) {
      const err = new Error('Provider not found');
      err.statusCode = 404;
      throw err;
    }
    const { ciphertext, iv, tag } = encrypt(fieldValue);
    return this.brokerRepository.upsertCredential(providerId, fieldName, ciphertext, iv, tag);
  }

  async enableProvider(id) {
    await this.brokerRepository.updateProvider(id, { enabled: true, updated_at: new Date() });
    const provider = await this.brokerRepository.findProviderById(id);
    await this.brokerRepository.publishConfigChange(provider.provider);
    return { enabled: true, provider: provider.provider };
  }

  async disableProvider(id) {
    await this.brokerRepository.updateProvider(id, { enabled: false, status: 'DISABLED', updated_at: new Date() });
    const provider = await this.brokerRepository.findProviderById(id);
    await this.brokerRepository.publishConfigChange(provider.provider);
    return { enabled: false, provider: provider.provider };
  }

  async getDecryptedCredentials(provider) {
    const p = await this.brokerRepository.findProviderByName(provider);
    if (!p || !p.enabled) return null;
    const creds = {};
    for (const c of p.credentials) {
      if (c.is_active) {
        creds[c.field_name] = decrypt(c.ciphertext, c.iv, c.tag);
      }
    }
    return creds;
  }

  async getSessionToken(provider) {
    const key = `broker:session:${provider}`;
    const session = await this.brokerRepository.redis.get(key);
    if (session && session.token && session.expiresAt > Date.now()) {
      return session.token;
    }
    return null;
  }

  async saveSessionToken(provider, token, ttlSeconds) {
    const key = `broker:session:${provider}`;
    const session = { token, expiresAt: Date.now() + ttlSeconds * 1000 };
    // node-redis v4 takes options as an OBJECT. `set(key, val, 'EX', ttl)` is ioredis
    // syntax: the extra positional args are silently dropped and the key never expires.
    await this.brokerRepository.redis.publisher.set(key, JSON.stringify(session), { EX: ttlSeconds });
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    await this.brokerRepository.saveSession(
      provider,
      tokenHash,
      'CONNECTED',
      new Date(Date.now() + ttlSeconds * 1000)
    );
  }

  /** Drop the cached session so the next caller re-authenticates. */
  async clearSessionToken(provider) {
    await this.brokerRepository.redis.publisher.del(`broker:session:${provider}`);
    return { provider, cleared: true };
  }

  // ── Generic short-lived JSON store (interactive auth: request tokens, etc.) ──
  // node-redis v4 wants options as an OBJECT: `{ EX: ttl }`, not ioredis' positional 'EX', ttl.

  async setJson(key, value, ttlSeconds) {
    const opts = ttlSeconds > 0 ? { EX: ttlSeconds } : undefined;
    await this.brokerRepository.redis.publisher.set(key, JSON.stringify(value), opts);
  }

  async getJson(key) {
    return this.brokerRepository.redis.get(key);
  }

  async delKey(key) {
    await this.brokerRepository.redis.publisher.del(key);
  }

  async getProviderStatus(providerName) {
    const provider = await this.brokerRepository.findProviderByName(providerName);
    if (!provider) return { status: 'NOT_CONFIGURED' };
    if (!provider.enabled) return { status: 'DISABLED' };
    const session = await this.brokerRepository.findSession(providerName);
    return {
      status: session?.status || provider.status || 'DISCONNECTED',
      last_tested_at: provider.last_tested_at,
      expires_at: session?.expires_at,
      last_error: session?.last_error,
    };
  }

  async deleteProvider(id) {
    const provider = await this.brokerRepository.findProviderById(id);
    if (!provider) {
      const err = new Error('Provider not found');
      err.statusCode = 404;
      throw err;
    }
    await this.brokerRepository.deleteProvider(id);
    await this.brokerRepository.publishConfigChange(provider.provider);
  }
}

module.exports = BrokerService;
