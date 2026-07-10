/**
 * Credential Store
 * Fetches enabled providers from L7 API, reads session tokens from Redis,
 * and subscribes to provider changes for hot-reload.
 *
 * Priority: Redis token > DB credentials > env var fallback
 */
const { logger } = require('../utils/logger');

class CredentialStore {
  constructor({ redis, backendApiUrl }) {
    this.redis = redis;
    this.backendApiUrl = backendApiUrl || process.env.BACKEND_API_URL || 'http://backend-api:4000';
    this.providers = [];
    this.credentials = new Map();
    this.tokens = new Map();
    this.onChange = null;

    if (redis) {
      this.subscriber = redis.duplicate ? redis.duplicate() : null;
    }
  }

  /**
   * Initialize: fetch enabled providers, load their credentials and tokens
   */
  async init() {
    await this.refreshProviders();
    this.subscribeToChanges();
  }

  /**
   * Fetch enabled providers from L7 API
   */
  async refreshProviders() {
    try {
      const axios = require('axios');
      const resp = await axios.get(`${this.backendApiUrl}/api/v1/providers`, { timeout: 5000 });
      if (resp.data?.success && Array.isArray(resp.data.data)) {
        const enabled = resp.data.data.filter((p) => p.enabled && (p.role === 'data' || p.role === 'both'));
        const changed = this.detectChanges(enabled);
        if (changed) {
          this.providers = enabled;
          logger.info(`CredentialStore: ${enabled.length} enabled providers loaded from API`);
          await this.loadTokens();
          if (this.onChange) this.onChange(this.providers);
        }
      } else {
        this.fallbackToEnv();
      }
    } catch (err) {
      logger.warn(`CredentialStore: API unavailable (${err.message}), falling back to env vars`);
      this.fallbackToEnv();
    }
  }

  detectChanges(newProviders) {
    if (newProviders.length !== this.providers.length) return true;
    const oldNames = new Set(this.providers.map((p) => `${p.provider}:${p.enabled}`));
    const newNames = new Set(newProviders.map((p) => `${p.provider}:${p.enabled}`));
    return oldNames.size !== newNames.size || ![...oldNames].every((n) => newNames.has(n));
  }

  fallbackToEnv() {
    const envProvider = process.env.MARKET_DATA_PROVIDER || 'kite';
    this.providers = [{ provider: envProvider, enabled: true, role: 'data', priority: 1 }];
    logger.info(`CredentialStore: Using env fallback provider: ${envProvider}`);
  }

  /**
   * Read session tokens from Redis for each enabled provider
   */
  async loadTokens() {
    for (const p of this.providers) {
      try {
        const key = `broker:session:${p.provider}`;
        const raw = await this.redis.get(key);
        if (raw) {
          const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (cached && cached.token && cached.expiresAt > Date.now()) {
            this.tokens.set(p.provider, cached.token);
            logger.info(`CredentialStore: Found valid token for ${p.provider}`);
          }
        }
      } catch (err) {
        // Token not available - vendor will report "waiting for session"
      }
    }
  }

  /**
   * Subscribe to Redis provider change events for hot-reload
   */
  subscribeToChanges() {
    if (!this.subscriber) {
      logger.warn('CredentialStore: No Redis subscriber available, skipping live updates');
      return;
    }
    try {
      this.subscriber.subscribe('providers-changed', (message) => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          logger.info(`CredentialStore: providers-changed for ${data.provider}, refreshing...`);
          this.refreshProviders();
        } catch (e) {
          logger.warn('CredentialStore: Failed to parse providers-changed message');
        }
      });
      logger.info('CredentialStore: Subscribed to providers-changed');
    } catch (err) {
      logger.warn(`CredentialStore: Redis subscribe failed: ${err.message}`);
    }
  }

  /**
   * Get list of enabled provider names (sorted by priority)
   */
  getEnabledProviderNames() {
    return this.providers
      .sort((a, b) => (a.priority || 1) - (b.priority || 1))
      .map((p) => p.provider);
  }

  /**
   * Get session token for a provider (from Redis)
   */
  getToken(provider) {
    return this.tokens.get(provider) || null;
  }

  /**
   * Check if provider has a valid token
   */
  hasValidToken(provider) {
    const token = this.tokens.get(provider);
    return !!token;
  }

  /**
   * Reload providers and hook into VendorManager
   */
  onProvidersChange(callback) {
    this.onChange = callback;
  }
}

module.exports = { CredentialStore };
