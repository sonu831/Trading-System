/**
 * CredentialStore — reads enabled providers from L7 API, cache tokens from Redis.
 * Subscribes to `providers-changed` for hot-reload without restart.
 */
const logger = require('../utils/logger');

interface Provider {
  provider: string;
  enabled: boolean;
  role: string;
  priority: number;
}

interface OnChangeCallback {
  (providers: Provider[]): void;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttl: number): Promise<void>;
  duplicate(): RedisClient;
  subscribe(channel: string, callback: (msg: string) => void): Promise<void>;
}

class CredentialStore {
  redis: RedisClient;
  backendApiUrl: string;
  providers: Provider[];
  tokens: Map<string, string>;
  onChange: OnChangeCallback | null;
  subscriber: RedisClient | null;

  constructor({ redis, backendApiUrl }: { redis: RedisClient; backendApiUrl?: string }) {
    this.redis = redis;
    this.backendApiUrl = backendApiUrl || process.env.BACKEND_API_URL || 'http://backend-api:4000';
    this.providers = [];
    this.tokens = new Map();
    this.onChange = null;
    this.subscriber = redis.duplicate ? redis.duplicate() : null;
  }

  async init(): Promise<void> {
    await this.refreshProviders();
    this.subscribeToChanges();
  }

  async refreshProviders(): Promise<void> {
    try {
      const axios = require('axios');
      const resp = await axios.get(`${this.backendApiUrl}/api/v1/providers`, { timeout: 5000 });
      if (resp.data?.success && Array.isArray(resp.data.data)) {
        const enabled = (resp.data.data as Provider[]).filter(p => p.enabled && (p.role === 'data' || p.role === 'both'));
        if (this.detectChanges(enabled)) {
          this.providers = enabled;
          logger.info(`CredentialStore: ${enabled.length} enabled providers loaded`);
          await this.loadTokens();
          if (this.onChange) this.onChange(this.providers);
        }
      } else {
        this.fallbackToEnv();
      }
    } catch (err: any) {
      logger.warn(`CredentialStore: API unavailable (${err.message}), fallback to env`);
      this.fallbackToEnv();
    }
  }

  private detectChanges(newProviders: Provider[]): boolean {
    if (newProviders.length !== this.providers.length) return true;
    const oldSet = new Set(this.providers.map(p => `${p.provider}:${p.enabled}`));
    return newProviders.some(p => !oldSet.has(`${p.provider}:${p.enabled}`));
  }

  private fallbackToEnv(): void {
    const envProvider = process.env.MARKET_DATA_PROVIDER || 'kite';
    this.providers = [{ provider: envProvider, enabled: true, role: 'data', priority: 1 }];
    logger.info(`CredentialStore: Using env fallback: ${envProvider}`);
  }

  private async loadTokens(): Promise<void> {
    for (const p of this.providers) {
      try {
        const raw = await this.redis.get(`broker:session:${p.provider}`);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.token && cached?.expiresAt > Date.now()) {
            this.tokens.set(p.provider, cached.token);
            logger.info(`CredentialStore: Found token for ${p.provider}`);
          }
        }
      } catch (_) { /* token not available — vendor works in 'waiting' mode */ }
    }
  }

  private subscribeToChanges(): void {
    if (!this.subscriber) {
      logger.warn('CredentialStore: No Redis subscriber, skipping live updates');
      return;
    }
    this.subscriber.subscribe('providers-changed', (message: string) => {
      try {
        const data = JSON.parse(message);
        logger.info(`CredentialStore: providers-changed for ${data.provider}, refreshing...`);
        this.refreshProviders();
      } catch (e: any) { logger.warn('CredentialStore: parse failed for providers-changed'); }
    }).catch((err: any) => {
      logger.warn(`CredentialStore: Redis subscribe failed: ${err.message}`);
    });
    logger.info('CredentialStore: Subscribed to providers-changed');
  }

  getEnabledProviderNames(): string[] {
    return this.providers.sort((a, b) => (a.priority || 1) - (b.priority || 1)).map(p => p.provider);
  }

  getToken(provider: string): string | null { return this.tokens.get(provider) || null; }

  hasValidToken(provider: string): boolean { return this.tokens.has(provider); }

  onProvidersChange(callback: OnChangeCallback): void { this.onChange = callback; }
}

module.exports = { CredentialStore };
export type { Provider, OnChangeCallback, RedisClient };
