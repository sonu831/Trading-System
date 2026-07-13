/**
 * Broker Session Service — centralized auth for ALL broker providers.
 * 
 * The ONLY place a broker login happens. L1/L10 read the token from Redis.
 * One login, one token, one refresh loop, one audit trail.
 *
 * @module L7 BrokerSessionService
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const crypto = require('crypto');
const { getStrategy, listStrategies } = require('./strategies');
const { secondsUntilISTMidnight, secondsUntilNextISTHour } = require('./strategies');

const PENDING_KEY = (p: string) => `broker:pending:${p}`;

let OTPAuth: any = null;

function normalizeBase32Secret(raw: unknown): string {
  let s = String(raw ?? '').trim();
  if (!s) throw new Error('totp_secret is empty');
  if (/^otpauth:\/\//i.test(s)) {
    const m = s.match(/[?&]secret=([^&]+)/i);
    if (!m) throw new Error('totp_secret otpauth:// URI has no secret= parameter');
    s = decodeURIComponent(m[1]);
  }
  s = s.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();
  if (!/^[A-Z2-7]+$/.test(s)) {
    throw new Error('totp_secret is not valid Base32 (A-Z, 2-7). Copy the secret key from trade.mstock.com → Trading APIs → Enable TOTP.');
  }
  return s;
}

function generateTOTP(secret: string): string {
  if (!OTPAuth) OTPAuth = require('otpauth');

  // Validate via the same strict function the API uses for credential storage.
  // A 6-digit generated OTP code is NOT a secret key — it will FAIL here with a
  // descriptive error instead of silently producing wrong TOTP codes.
  const clean = normalizeBase32Secret(secret);

  const secretObj = OTPAuth.Secret.fromBase32(clean);
  return new OTPAuth.TOTP({
    secret: secretObj,
    algorithm: 'SHA1', digits: 6, period: 30,
  }).generate();
}

interface BrokerService {
  getDecryptedCredentials(provider: string): Promise<Record<string, string> | null>;
  getSessionToken(provider: string): Promise<string | null>;
  saveSessionToken(provider: string, token: string, ttl: number): Promise<void>;
  clearSessionToken(provider: string): Promise<void>;
  saveAccessToken(provider: string, token: string): Promise<void>;
  setJson(key: string, value: unknown, ttl: number): Promise<void>;
  getJson(key: string): Promise<unknown>;
  delKey(key: string): Promise<void>;
}

interface AuthResult {
  success: boolean;
  token?: string;
  ttlSeconds?: number;
  status?: 'connected' | 'needs_input' | 'error';
  stage?: string;
  error?: string;
  provider?: string;
  auth_type?: string;
  pending?: Record<string, unknown>;
  pendingTtlSeconds?: number;
}

interface StrategyDeps {
  http: any;
  generateTOTP: (s: string) => string;
  sha256: (s: string) => string;
  now?: unknown;
}

class BrokerSessionService {
  private brokerService: BrokerService;
  deps: StrategyDeps;

  constructor({ brokerService }: { brokerService: BrokerService }) {
    this.brokerService = brokerService;
    this.deps = {
      http: require('axios'),
      generateTOTP,
      sha256: (s: string) => crypto.createHash('sha256').update(s).digest('hex'),
    };
  }

  listStrategies() { return listStrategies(); }

  async getCredentials(provider: string) { return this.brokerService.getDecryptedCredentials(provider); }

  async getCachedToken(provider: string): Promise<string | null> { return this.brokerService.getSessionToken(provider); }

  async saveToken(provider: string, token: string, ttlSeconds: number): Promise<void> {
    return this.brokerService.saveSessionToken(provider, token, ttlSeconds);
  }

  async savePending(provider: string, pending: Record<string, unknown>, ttlSeconds: number): Promise<void> {
    return this.brokerService.setJson(PENDING_KEY(provider), pending, ttlSeconds);
  }
  async loadPending(provider: string): Promise<unknown> { return this.brokerService.getJson(PENDING_KEY(provider)); }
  async clearPending(provider: string): Promise<void> { return this.brokerService.delKey(PENDING_KEY(provider)); }

  async testConnection(provider: string, input: Record<string, unknown> | null = null): Promise<AuthResult> {
    const strategy = getStrategy(provider) as any;
    if (!strategy) {
      return { success: false, error: `Unknown provider: ${provider}` };
    }
    const creds = await this.getCredentials(provider);
    if (!creds) return { success: false, error: `No credentials configured for ${provider}` };
    // Fail before any network call: a missing api_key must not reach the broker.
    const missing = (strategy.requiredFields as string[]).filter((f: string) => !creds[f]);
    if (missing.length) {
      return { success: false, stage: 'credentials', error: `Missing: ${missing.join(', ')}`, missing, required: strategy.requiredFields } as AuthResult;
    }
    const pending = input ? await this.loadPending(provider) : null;
    const result = await strategy.authenticate(creds, this.deps, { input, pending });
    return this.applyResult(provider, result);
  }

  async completeSession(provider: string, input: Record<string, unknown>): Promise<AuthResult> {
    const strategy = getStrategy(provider) as any;
    if (!strategy) return { success: false, error: `Unknown provider: ${provider}` };
    const supplied = Object.keys(input).filter(k => input[k]);
    const accepted = supplied.filter((k: string) => (strategy.interactiveInputs as string[]).includes(k));
    if (!accepted.length) {
      return { success: false, stage: 'input', error: `${provider} expects: ${strategy.interactiveInputs.join(', ')}` };
    }
    return this.testConnection(provider, input);
  }

  /**
   * The single place a raw broker token may exist in a response. It never leaves here:
   * callers get `token_length` so a UI can show "connected" without ever handling the
   * credential itself.
   */
  private async applyResult(provider: string, result: AuthResult): Promise<AuthResult> {
    const strategy = getStrategy(provider) as any;

    if (result.status === 'needs_input') {
      await this.savePending(provider, result.pending || {}, result.pendingTtlSeconds || 300);
      const { pending, pendingTtlSeconds, ...safe } = result as any;
      // Tell the caller WHICH input to prompt for, without leaking the parked token.
      return { ...safe, inputType: strategy?.interactiveInputs?.[0] };
    }

    if (!result.success) {
      const { retryPending, ...safe } = result as any;
      // A rejected OTP must not discard the parked login: re-logging in would send the
      // user a second code and invalidate the one they are holding.
      if (!retryPending) await this.clearPending(provider);
      return safe;
    }

    await this.clearPending(provider);
    let token_length: number | undefined;
    if (result.token) {
      await this.saveToken(provider, result.token, result.ttlSeconds || 21000);
      await this.brokerService.saveAccessToken(provider, result.token);
      token_length = String(result.token).length;
    }
    // Update provider status in DB so dashboard reflects CONNECTED / ERROR
    try {
      const brokerRepo = (require('../../container').resolve('brokerRepository') as any);
      const p = await brokerRepo.findProviderByName(provider);
      if (p) {
        await brokerRepo.updateProvider(p.id, {
          status: result.success ? 'CONNECTED' : 'ERROR',
          last_tested_at: new Date(),
        });
        console.log(`[broker-session] status updated: ${provider} → ${result.success ? 'CONNECTED' : 'ERROR'}`);
      }
    } catch (err: any) {
      console.error(`[broker-session] status update failed for ${provider}:`, err.message);
    }
    const { token, ttlSeconds, ...safe } = result as any;
    return { ...safe, token_length };
  }

  async getOrRefreshToken(provider: string): Promise<string | null> {
    const cached = await this.getCachedToken(provider);
    if (cached) return cached;

    // Never trigger an interactive login during background refresh.
    // If the strategy requires a human (OTP, redirect, request_code), bail out
    // instead of silently sending an SMS or prompting the browser.
    const strategy = getStrategy(provider) as any;
    if (strategy) {
      const creds = await this.brokerService.getDecryptedCredentials(provider);
      if (creds && !strategy.canAuthenticateUnattended(creds)) {
        return null;
      }
    }

    const result = await this.testConnection(provider);
    return result.success ? this.getCachedToken(provider) : null;
  }

  async invalidateSession(provider: string): Promise<void> {
    await this.clearPending(provider);
    return this.brokerService.clearSessionToken(provider);
  }

  /**
   * Session monitor loop — proactive re-auth before expiry (E1, E2).
   * Runs every 5 minutes per enabled provider. If a token has <30 min remaining
   * and unattended auth is possible → re-authenticates silently.
   * Otherwise → publishes an actionable alert to the notifications channel.
   */
  startSessionMonitor() {
    const providers = this.listStrategies().filter((s: any) => s.id !== 'indianapi');
    const TTL_WARN_THRESHOLD = 1800; // 30 minutes

    const monitorOne = async (provider: string) => {
      try {
        const token = await this.getCachedToken(provider);
        if (!token) return; // No active session

        const creds = await this.brokerService.getDecryptedCredentials(provider);
        if (!creds) return;

        const strategy = getStrategy(provider) as any;
        if (!strategy) return;

        // Check TTL remaining from Redis
        const raw = await this.brokerService.getJson(`broker:session:${provider}`);
        const session = raw && typeof raw === 'object' ? raw as any : null;
        const expiresAt = session?.expiresAt;
        if (!expiresAt) return;

        const remaining = Math.floor((expiresAt - Date.now()) / 1000);
        if (remaining > TTL_WARN_THRESHOLD && remaining > 0) return; // Still fresh

        if (strategy.canAuthenticateUnattended(creds)) {
          // Auto re-auth — unattended possible
          console.log(`[broker-session] auto re-auth ${provider} (${remaining}s remaining)`);
          const result = await this.testConnection(provider);
          if (!result.success) {
            this.publishAlert(provider, 'error', `Auto re-auth failed: ${result.error}`);
          }
        } else {
          // Interactive needed — publish alert
          this.publishAlert(provider, 'warn',
            `${provider} session expires in ${Math.floor(remaining / 60)}min — re-enter TOTP to extend`);
        }
      } catch (err: any) {
        console.error(`[broker-session] monitor error for ${provider}:`, err.message);
      }
    };

    // Run immediately, then every 5 minutes
    console.log('[broker-session] session monitor started (5-min interval)');
    providers.forEach(p => monitorOne(p.id));
    setInterval(() => providers.forEach(p => monitorOne(p.id)), 5 * 60 * 1000);
  }

  /**
   * Liveness probe — call a cheap authenticated endpoint to verify
   * the token actually WORKS (resolves GAP-E3: false green).
   */
  async probeLiveness(provider: string): Promise<{ ok: boolean; error?: string; lastValidatedAt?: string }> {
    try {
      const token = await this.getCachedToken(provider);
      if (!token) return { ok: false, error: 'no cached token' };

      const creds = await this.brokerService.getDecryptedCredentials(provider);
      if (!creds) return { ok: false, error: 'no credentials' };

      if (provider === 'mstock') {
        // Probe using the broker SDK directly with the token — lightweight call to /profile
        try {
          const MConnect = require('@mstock-mirae-asset/nodetradingapi-typeb').MConnect;
          const probeClient = new MConnect('https://api.mstock.trade', creds.api_key);
          probeClient.setAccessToken(token);
          const body = await probeClient.profile();
          const ok = !!(body?.data?.clientcode);
          if (ok) {
            return { ok: true, lastValidatedAt: new Date().toISOString() };
          }
          return { ok: false, error: 'profile check returned no clientcode' };
        } catch (err: any) {
          return { ok: false, error: err.message || 'profile probe failed' };
        }
      }

      if (provider === 'flattrade') {
        // FlatTrade: probe via UserDetails with jKey
        try {
          const res = await this.deps.http.post('https://piconnect.flattrade.in/PiConnectAPI/UserDetails', {
            jKey: token,
          }, { timeout: 5000 });
          const ok = res?.data?.stat === 'Ok';
          return { ok, lastValidatedAt: ok ? new Date().toISOString() : undefined, error: ok ? undefined : res?.data?.emsg };
        } catch (err: any) {
          return { ok: false, error: err.message || 'UserDetails probe failed' };
        }
      }

      return { ok: false, error: `provider ${provider} has no liveness probe` };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }

  /** ── In-process single-flight auth lock (E4) ── */
  private authLocks = new Map<string, Promise<any>>();
  private LOCK_TTL = 30; // seconds

  async withAuthLock(provider: string, fn: () => Promise<any>): Promise<any> {
    // In-process lock
    if (this.authLocks.has(provider)) return this.authLocks.get(provider);
    // Redis distributed lock for multi-instance
    const lockKey = `broker:authlock:${provider}`;
    const lockToken = crypto.randomUUID?.() || crypto.randomBytes(16).toString('hex');
    try { await this.brokerService.setJson(lockKey, lockToken, this.LOCK_TTL); } catch (_) {}
    const promise = fn().finally(async () => {
      this.authLocks.delete(provider);
      try {
        const held = await this.brokerService.getJson(lockKey);
        if (held === lockToken) await this.brokerService.delKey(lockKey);
      } catch (_) {}
    });
    this.authLocks.set(provider, promise);
    return promise;
  }

  /** Publish alert to Redis pub/sub channel (canonical ALERTS channel) */
  private async publishAlert(provider: string, severity: string, message: string) {
    try {
      // Get Redis publisher directly from the brokerService's repository, not the DI container.
      // This avoids the cyclic Awilix resolution: BrokerService ↔ BrokerSessionService.
      const redisClient = (this.brokerService as any).brokerRepository?.redis;
      const pub = redisClient?.publisher || redisClient;
      if (pub?.publish) {
        const { REDIS_CHANNELS } = require('/app/shared/constants');
        if (REDIS_CHANNELS?.ALERTS) {
          await pub.publish(REDIS_CHANNELS.ALERTS, JSON.stringify({
            severity, message, provider,
            source: 'broker-session-monitor',
            timestamp: new Date().toISOString(),
          }));
        }
      }
    } catch (_) { /* best effort */ }
  }
}

module.exports = BrokerSessionService;
module.exports.secondsUntilISTMidnight = secondsUntilISTMidnight;
// Was `= secondsUntilISTHour`, a name defined nowhere: a ReferenceError the moment this
// module was imported. It went unnoticed because the only test that imports it required a
// `.js` path the TypeScript migration had renamed away, so the file never once loaded.
module.exports.secondsUntilNextISTHour = secondsUntilNextISTHour;
module.exports.generateTOTP = generateTOTP;
// Exported so tests can assert a non-Base32 secret is REJECTED rather than silently
// falling back to raw bytes and emitting a valid-looking but wrong TOTP code.
module.exports.normalizeBase32Secret = normalizeBase32Secret;
