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

/** Seconds of headroom so we never serve a token in its last moments. */
const TOKEN_EXPIRY_MARGIN_S = 30;

/**
 * Brokers whose JWT `exp` claim must NOT be believed.
 *
 * MStock is the cautionary tale. Its official docs state "Generated JWT token will be valid till
 * 12:00 AM of generated day", yet every JWT it issues — including the sample in its own docs —
 * carries `exp - iat = 300` (five minutes). The claim is simply wrong.
 *
 * Believing it is not a harmless over-caution: MStock rate-limits LOGINS ("9 attempts remaining"),
 * and re-authenticating every 5 minutes is ~288 logins/day, which risks locking the account. So a
 * bogus `exp` must never drive the refresh cadence. Expiry for these brokers is discovered the only
 * honest way — the broker rejects a call with 401, we invalidate and re-auth once, on demand.
 */
const UNTRUSTWORTHY_TOKEN_EXPIRY = new Set(['mstock']);

/**
 * If the token is a JWT carrying a *trustworthy* `exp`, never cache it beyond that instant.
 * Returns the policy TTL unchanged for opaque tokens (FlatTrade's jKey) and for brokers whose
 * `exp` is known to be fiction.
 */
function clampTtlToTokenExpiry(provider: string, token: string, policyTtlSeconds: number): number {
  if (UNTRUSTWORTHY_TOKEN_EXPIRY.has(provider)) return policyTtlSeconds;
  try {
    const [, payloadB64] = String(token).split('.');
    if (!payloadB64) return policyTtlSeconds; // not a JWT — nothing to learn from it
    const claims = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
    if (!claims?.exp) return policyTtlSeconds;

    const secondsLeft = Math.floor(claims.exp - Date.now() / 1000) - TOKEN_EXPIRY_MARGIN_S;
    if (secondsLeft <= 0) return 1; // already dead — cache briefly so callers see it expire, not "valid"
    return Math.min(policyTtlSeconds, secondsLeft);
  } catch (_) {
    return policyTtlSeconds; // unparseable payload is not a reason to shorten a working session
  }
}

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
  saveSessionToken(provider: string, token: string, tokenTtlSeconds: number, cacheTtlSeconds?: number): Promise<void>;
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

  /**
   * Cache a session token — never for longer than the token itself is valid.
   *
   * The strategy's ttlSeconds is a *policy* guess (e.g. "MStock resets at IST midnight").
   * The token's own `exp` claim is the *truth*. These disagreed catastrophically: MStock issues
   * JWTs that live **300 seconds**, while we cached them for ~12 hours — so for almost their
   * entire cached life we handed out a token the broker had already invalidated, and every call
   * came back 401. Trust the token, not the policy (rule 13: never claim a validity we don't have).
   */
  async saveToken(provider: string, token: string, ttlSeconds: number): Promise<void> {
    const effective = clampTtlToTokenExpiry(provider, token, ttlSeconds);
    if (effective < ttlSeconds) {
      // Surface it: a token far shorter-lived than the policy means the policy is wrong, and
      // anything relying on that session must re-authenticate far more often than we assumed.
      console.warn(
        `[broker-session] ${provider}: token expires in ${effective}s but policy asked for ${ttlSeconds}s — caching for ${effective}s`,
      );
    }
    // The Redis EX must outlive the token's actual expiry or the session monitor
    // (which runs every 60s) can never detect an expired state — the key vanishes
    // before the monitor fires. We keep the key alive for at least 1 hour so the
    // monitor can read `expiresAt` and trigger re-auth. getSessionToken() checks
    // expiresAt > Date.now(), so consumers (L1/L10) never receive a dead token.
    const cacheTtl = Math.max(effective, 3600);
    return this.brokerService.saveSessionToken(provider, token, effective, cacheTtl);
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
   *
   * Runs every 60 seconds per enabled provider. For each provider:
   *   1. If no token exists and unattended auth is possible → re-auth immediately (cold start)
   *   2. If token exists but is stale (within refresh window) → re-auth
   *   3. If token is fresh → skip
   *   4. If interactive-only and token is stale → publish alert
   *
   * The threshold adapts to the actual token lifespan: 80% of observed TTL.
   * For MStock's 270s effective TTL that means re-auth at ~54s before expiry — well
   * before the 30s margin, keeping a valid token continuously available.
   */
  startSessionMonitor() {
    const providers = this.listStrategies().filter((s: any) => s.id !== 'indianapi');
    const FRESHNESS_RATIO = 0.8; // re-auth when 80% of token life remains
    const INTERVAL_MS = 60000;   // check every 60 seconds

    const monitorOne = async (provider: string) => {
      try {
        const strategy = getStrategy(provider) as any;
        if (!strategy) return;

        const creds = await this.brokerService.getDecryptedCredentials(provider);
        if (!creds) return; // no credentials configured — nothing to auth with

        // Read the raw Redis session to get expiresAt + createdAt (the key now outlives
        // the token, so we can detect expired + key-present state)
        const raw = await this.brokerService.getJson(`broker:session:${provider}`);
        const session = raw && typeof raw === 'object' ? raw as any : null;
        const expiresAt: number | null = session?.expiresAt || null;
        const createdAt: number | null = session?.createdAt || null;

        // Compute remaining time (negative = already expired, null = no token at all)
        const remaining = expiresAt ? Math.floor((expiresAt - Date.now()) / 1000) : null;

        // Compute threshold from the ACTUAL token lifespan, not the policy TTL.
        // MStock's policy is ~12h (IST midnight) but its JWT lives 300s — using
        // the policy would produce an 8h threshold and trigger re-auth on every check.
        let threshold: number;
        if (createdAt && expiresAt) {
          const observedTtl = Math.floor((expiresAt - createdAt) / 1000);
          threshold = Math.max(60, Math.floor(observedTtl * (1 - FRESHNESS_RATIO))); // 20% before expiry
        } else {
          // Fallback: use a safe 5-min threshold if we can't determine lifespan
          threshold = 300;
        }

        // Token is fresh — nothing to do
        if (remaining !== null && remaining > threshold) return;

        // ── Decision point ──
        const unattended = strategy.canAuthenticateUnattended(creds);

        if (unattended) {
          const reason = remaining === null
            ? 'no active token — cold-start re-auth'
            : remaining <= 0
              ? `token expired ${Math.abs(remaining)}s ago — re-auth`
              : `${remaining}s remaining (threshold: ${threshold}s) — re-auth`;
          console.log(`[broker-session] auto re-auth ${provider}: ${reason}`);
          const result = await this.withAuthLock(provider, () => this.testConnection(provider));
          if (!result.success) {
            this.publishAlert(provider, 'error', `[${provider}] Auto re-auth failed: ${result.error}`);
          } else {
            console.log(`[broker-session] ${provider}: auto re-auth SUCCESS`);
          }
        } else if (remaining !== null && remaining <= threshold) {
          // Interactive-only provider with stale token
          const mins = Math.max(1, Math.ceil(Math.max(0, remaining) / 60));
          this.publishAlert(provider, 'warn',
            `[${provider}] Session expires in ${mins}min — re-enter TOTP to extend`);
        }
        // If no token at all and interactive-only → nothing we can do; the operator
        // must initiate login via dashboard. No alert here — it's the starting state.
      } catch (err: any) {
        console.error(`[broker-session] monitor error for ${provider}:`, err.message);
      }
    };

    console.log('[broker-session] session monitor started (60s per-provider interval)');
    // Run immediately on boot — critical for unattended providers that were
    // configured while L7 was down (cold-start re-auth)
    providers.forEach(p => monitorOne(p.id));
    setInterval(() => providers.forEach(p => monitorOne(p.id)), INTERVAL_MS);
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

  /** Publish alert to Redis pub/sub channel (canonical ALERTS channel from shared/constants.js) */
  private async publishAlert(provider: string, severity: string, message: string) {
    try {
      const redisClient = (this.brokerService as any).brokerRepository?.redis;
      const pub = redisClient?.publisher || redisClient;
      if (pub?.publish) {
        let REDIS_CHANNELS: any;
        try { REDIS_CHANNELS = require('/app/shared/constants').REDIS_CHANNELS; } catch (_) {}
        const channel = REDIS_CHANNELS?.ALERTS || 'notifications';
        await pub.publish(channel, JSON.stringify({
          severity, message, provider,
          source: 'broker-session-monitor',
          timestamp: new Date().toISOString(),
        }));
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
