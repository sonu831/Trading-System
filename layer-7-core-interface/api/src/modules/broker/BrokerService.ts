const BaseService = require('../../common/services/BaseService');
const { encrypt, decrypt, maskValue } = require('../../utils/crypto');

interface ProviderMeta { id: number; provider: string; enabled: boolean; role: string; priority: number; status: string | null; credentials: Array<{ field_name: string; is_active: boolean }>; }

class BrokerService extends BaseService {
  brokerRepository: any;
  constructor({ brokerRepository }: { brokerRepository: any }) { super({ redis: brokerRepository.redis }); this.brokerRepository = brokerRepository; }

  async listProviders(): Promise<ProviderMeta[]> {
    const p = await this.brokerRepository.findAllProviders();
    return p.map((r: any) => ({ id: r.id, provider: r.provider, enabled: r.enabled, role: r.role, priority: r.priority, status: r.status, credentials: (r.credentials || []).map((c: any) => ({ field_name: c.field_name, is_active: c.is_active })), created_at: r.created_at, updated_at: r.updated_at }));
  }

  async getProvider(id: number): Promise<any> {
    const p = await this.brokerRepository.findProviderById(id);
    if (!p) { const e: any = new Error('Provider not found'); e.statusCode = 404; throw e; }
    return { ...p, credentials: p.credentials.map((c: any) => ({ field_name: c.field_name, value: maskValue(decrypt(c.ciphertext, c.iv, c.tag)) })) };
  }

  async createProvider(data: any): Promise<any> {
    const e = await this.brokerRepository.findProviderByName(data.provider);
    if (e) { const err: any = new Error(`Provider "${data.provider}" already exists`); err.statusCode = 409; throw err; }
    return this.brokerRepository.createProvider({ provider: data.provider, role: data.role || 'data', priority: data.priority || 1, enabled: data.enabled !== undefined ? data.enabled : false });
  }

  async updateProvider(id: number, data: any): Promise<any> { return this.brokerRepository.updateProvider(id, { ...data, updated_at: new Date() }); }

  async saveCredential(providerId: number, fieldName: string, fieldValue: string): Promise<any> {
    const p = await this.brokerRepository.findProviderById(providerId);
    if (!p) { const e: any = new Error('Provider not found'); e.statusCode = 404; throw e; }
    const { ciphertext, iv, tag } = encrypt(fieldValue);
    return this.brokerRepository.upsertCredential(providerId, fieldName, ciphertext, iv, tag);
  }

  async deleteCredential(providerId: number, fieldName: string): Promise<any> {
    const p = await this.brokerRepository.findProviderById(providerId);
    if (!p) { const e: any = new Error('Provider not found'); e.statusCode = 404; throw e; }
    await this.brokerRepository.deleteCredential(providerId, fieldName);
  }

  async saveAccessToken(provider: string, token: string): Promise<void> {
    const p = await this.brokerRepository.findProviderByName(provider);
    if (!p) { const e: any = new Error('Provider not found'); e.statusCode = 404; throw e; }
    const { ciphertext, iv, tag } = encrypt(token);
    await this.brokerRepository.upsertCredential(p.id, 'access_token', ciphertext, iv, tag);
  }

  async saveCredentials(providerId: number, fields: Array<{ field_name: string; field_value: string }>): Promise<any> {
    const p = await this.brokerRepository.findProviderById(providerId);
    if (!p) { const e: any = new Error('Provider not found'); e.statusCode = 404; throw e; }
    for (const f of fields) {
      if (!f.field_value) {
        await this.brokerRepository.deleteCredential(providerId, f.field_name);
      } else {
        const { ciphertext, iv, tag } = encrypt(f.field_value);
        await this.brokerRepository.upsertCredential(providerId, f.field_name, ciphertext, iv, tag);
      }
    }
  }

  async enableProvider(id: number): Promise<any> { await this.brokerRepository.updateProvider(id, { enabled: true, updated_at: new Date() }); const p = await this.brokerRepository.findProviderById(id); await this.brokerRepository.publishConfigChange(p!.provider); return { enabled: true, provider: p!.provider }; }
  async disableProvider(id: number): Promise<any> { await this.brokerRepository.updateProvider(id, { enabled: false, status: 'DISABLED', updated_at: new Date() }); const p = await this.brokerRepository.findProviderById(id); await this.brokerRepository.publishConfigChange(p!.provider); return { enabled: false, provider: p!.provider }; }

  async getDecryptedCredentials(provider: string): Promise<Record<string, string> | null> {
    const p = await this.brokerRepository.findProviderByName(provider);
    if (!p?.enabled) return null;
    const creds: Record<string, string> = {};
    for (const c of p.credentials) { if (c.is_active) creds[c.field_name] = decrypt(c.ciphertext, c.iv, c.tag); }
    return creds;
  }

  async getSessionToken(provider: string): Promise<string | null> {
    const raw = await this.brokerRepository.redis.publisher.get(`broker:session:${provider}`);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s?.token && s?.expiresAt > Date.now() ? s.token : null;
  }

  async saveSessionToken(provider: string, token: string, tokenTtlSeconds: number, cacheTtlSeconds?: number): Promise<void> {
    const key = `broker:session:${provider}`;
    const now = Date.now();
    const expiresAt = now + tokenTtlSeconds * 1000;
    const redisTtl = cacheTtlSeconds ?? tokenTtlSeconds;
    await this.brokerRepository.redis.publisher.set(key, JSON.stringify({ token, expiresAt, createdAt: now }), { EX: redisTtl });
    const crypto = require('crypto');
    await this.brokerRepository.saveSession(provider, crypto.createHash('sha256').update(token).digest('hex'), 'CONNECTED', new Date(expiresAt));
    // Publish session change so L1 VendorManager can hot-reload the token (GAP-I1)
    try { await this.brokerRepository.redis.publisher.publish('broker-session-changed', JSON.stringify({ provider, expiresAt })); } catch (_) {}
  }

  async getProviderStatus(providerName: string): Promise<Record<string, unknown>> {
    const p = await this.brokerRepository.findProviderByName(providerName);
    if (!p) return { status: 'NOT_CONFIGURED' };
    if (!p.enabled) return { status: 'DISABLED' };
    const s = await this.brokerRepository.findSession(providerName);

    // GAP-E3: run liveness probe when a token exists — presence ≠ liveness
    let liveness = null;
    if (s?.status === 'CONNECTED' && this.brokerSessionService) {
      try {
        liveness = await this.brokerSessionService.probeLiveness(providerName);
      } catch (_) { /* probe best-effort */ }
    }

    const status = liveness?.ok === false
      ? 'EXPIRED'
      : liveness?.ok === true
        ? 'CONNECTED'
        : (s?.status || p.status || 'DISCONNECTED');

    return {
      status,
      last_tested_at: p.last_tested_at,
      last_validated_at: liveness?.lastValidatedAt || null,
      expires_at: s?.expires_at,
      last_error: liveness?.error || s?.last_error,
    };
  }

  async deleteProvider(id: number): Promise<any> {
    const p = await this.brokerRepository.findProviderById(id);
    if (!p) { const e: any = new Error('Provider not found'); e.statusCode = 404; throw e; }
    await this.brokerRepository.deleteProvider(id);
    await this.brokerRepository.publishConfigChange(p.provider);
  }

  // Redis helpers for BrokerSessionService
  async setJson(key: string, value: unknown, ttl: number): Promise<void> {
    await this.brokerRepository.redis.publisher.set(key, JSON.stringify(value), { EX: ttl });
  }
  async getJson(key: string): Promise<unknown> {
    const raw = await this.brokerRepository.redis.publisher.get(key);
    return raw ? JSON.parse(raw) : null;
  }
  async delKey(key: string): Promise<void> {
    await this.brokerRepository.redis.publisher.del(key);
  }
  async clearSessionToken(provider: string): Promise<void> {
    await this.brokerRepository.redis.publisher.del(`broker:session:${provider}`);
  }
}

module.exports = BrokerService;
