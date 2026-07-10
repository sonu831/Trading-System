/**
 * CredentialProvider — reads providers + decrypted credentials from L7 API,
 * session tokens from Redis. Subscribes to `providers-changed` for hot reload.
 *
 * This replaces the direct `.env` credential reads in config/default.ts.
 * L10 no longer needs MSTOCK_* / FLATTRADE_* env vars after this.
 */
const axios = require('axios');
const logger = require('./utils/logger');

interface Provider {
  provider: string;
  enabled: boolean;
  role: string;
  priority: number;
}

interface RedisClient {
  get(key: string): Promise<string | null>;
  duplicate(): RedisClient;
  subscribe(channel: string, callback: (msg: string) => void): Promise<void>;
}

export interface MStockCredentials {
  apiKey: string;
  accessToken: string;
  clientCode: string;
  baseUrl: string;
  endpoints: Record<string, string>;
}

export interface FlatTradeCredentials {
  userId: string;
  accountId: string;
  apiKey: string;
  token: string;
  baseUrl: string;
}

class CredentialProvider {
  private redis: RedisClient;
  private backendApiUrl: string;
  private providers: Provider[];
  private tokens: Map<string, string>;
  private credentialCache: Map<string, Record<string, string>>;
  private subscriber: RedisClient | null;
  private onChangeCallback: (() => void) | null;
  private retryTimer: ReturnType<typeof setInterval> | null;

  // Static config that doesn't change per-credential
  private readonly staticConfig = {
    mstock: {
      baseUrl: process.env.MSTOCK_BASE_URL || 'https://api.mstock.trade',
      endpoints: {
        placeOrder: '/openapi/typeb/orders/regular',
        modifyOrder: '/openapi/typeb/orders/regular',
        cancelOrder: '/openapi/typeb/orders/regular',
        orderBook: '/openapi/typeb/orders',
        positions: '/openapi/typeb/portfolio/positions',
        quote: '/openapi/typeb/instruments/quote',
        scripMaster: '/openapi/typeb/instruments/scriptmaster',
      },
    },
    flattrade: {
      baseUrl: process.env.FLATTRADE_BASE_URL || 'https://piconnect.flattrade.in/PiConnectAPI',
    },
  };

  constructor({ redis, backendApiUrl }: { redis: RedisClient; backendApiUrl?: string }) {
    this.redis = redis;
    this.backendApiUrl = backendApiUrl || process.env.BACKEND_API_URL || 'http://backend-api:4000';
    this.providers = [];
    this.tokens = new Map();
    this.credentialCache = new Map();
    this.subscriber = null;
    this.onChangeCallback = null;
    this.retryTimer = null;
  }

  async init(): Promise<void> {
    await this.refresh();
    await this.subscribeToChanges();
  }

  async refresh(): Promise<void> {
    try {
      const resp = await axios.get(`${this.backendApiUrl}/api/v1/providers`, { timeout: 5000 });
      if (resp.data?.success && Array.isArray(resp.data.data)) {
        const enabled = (resp.data.data as Provider[]).filter(
          (p) => p.enabled && (p.role === 'execution' || p.role === 'both'),
        );
        this.providers = enabled.sort((a, b) => (a.priority || 1) - (b.priority || 1));
        logger.info(`CredentialProvider: ${enabled.length} execution providers loaded`);

        await this.loadTokens();
        await this.loadDecryptedCredentials();
        if (this.onChangeCallback) this.onChangeCallback();
      } else {
        logger.warn('CredentialProvider: No providers from API, retrying in 30s');
        this.scheduleRetry();
      }
    } catch (err: any) {
      logger.warn(`CredentialProvider: API unavailable (${err.message}), retrying in 30s`);
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;
    this.retryTimer = setInterval(() => {
      logger.info('CredentialProvider: retrying...');
      this.refresh().catch(() => {});
    }, 30000);
  }

  private async loadTokens(): Promise<void> {
    for (const p of this.providers) {
      try {
        const raw = await this.redis.get(`broker:session:${p.provider}`);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.token && cached?.expiresAt > Date.now()) {
            this.tokens.set(p.provider, cached.token);
            logger.info(`CredentialProvider: token for ${p.provider} valid until ${new Date(cached.expiresAt).toISOString()}`);
          } else {
            logger.warn(`CredentialProvider: token for ${p.provider} expired or missing`);
          }
        }
      } catch (_) {
        /* token not available */
      }
    }
  }

  private async loadDecryptedCredentials(): Promise<void> {
    for (const p of this.providers) {
      try {
        const resp = await axios.get(
          `${this.backendApiUrl}/api/v1/providers/${p.provider}/credentials/decrypted`,
          { timeout: 5000 },
        );
        if (resp.data?.success && resp.data.data?.credentials) {
          this.credentialCache.set(p.provider, resp.data.data.credentials);
          logger.info(`CredentialProvider: loaded decrypted credentials for ${p.provider}`);
        }
      } catch (err: any) {
        logger.warn(`CredentialProvider: failed to load credentials for ${p.provider}: ${err.message}`);
      }
    }
  }

  private async subscribeToChanges(): Promise<void> {
    try {
      if (!this.subscriber && this.redis.duplicate) {
        this.subscriber = this.redis.duplicate();
        this.subscriber.on?.('error', (_err: any) => {});
        await this.subscriber.connect?.();
      }
      if (!this.subscriber) {
        logger.warn('CredentialProvider: No Redis subscriber available');
        return;
      }
      await this.subscriber.subscribe('providers-changed', (_msg: string) => {
        logger.info('CredentialProvider: providers-changed, refreshing...');
        if (this.retryTimer) { clearInterval(this.retryTimer); this.retryTimer = null; }
        this.refresh();
      });
      logger.info('CredentialProvider: Subscribed to providers-changed');
    } catch (err: any) {
      logger.warn(`CredentialProvider: Redis subscribe failed: ${err.message}`);
    }
  }

  getActiveBroker(): string | null {
    const enabled = this.providers.filter((p) => p.enabled);
    return enabled.length > 0 ? enabled[0].provider : null;
  }

  getMStockConfig(): MStockCredentials {
    const provider = 'mstock';
    const creds = this.credentialCache.get(provider) || {};
    const token = this.tokens.get(provider) || '';
    const staticCfg = this.staticConfig.mstock;
    return {
      apiKey: creds.api_key || '',
      accessToken: token,
      clientCode: creds.client_code || '',
      baseUrl: staticCfg.baseUrl,
      endpoints: staticCfg.endpoints,
    };
  }

  getFlatTradeConfig(): FlatTradeCredentials {
    const provider = 'flattrade';
    const creds = this.credentialCache.get(provider) || {};
    const token = this.tokens.get(provider) || '';
    const staticCfg = this.staticConfig.flattrade;
    return {
      userId: creds.api_key ? creds.api_key.split('_')[0] || creds.user_id || '' : creds.user_id || '',
      accountId: creds.api_key ? creds.api_key.split('_')[0] || creds.user_id || '' : creds.user_id || '',
      apiKey: creds.api_key || '',
      token,
      baseUrl: staticCfg.baseUrl,
    };
  }

  getToken(provider: string): string | null {
    return this.tokens.get(provider) || null;
  }

  onProvidersChange(callback: () => void): void {
    this.onChangeCallback = callback;
  }

  async stop(): Promise<void> {
    if (this.retryTimer) { clearInterval(this.retryTimer); this.retryTimer = null; }
    if (this.subscriber) {
      try { await this.subscriber.quit?.(); } catch (_) { /* ignore */ }
    }
  }
}

export { CredentialProvider };
