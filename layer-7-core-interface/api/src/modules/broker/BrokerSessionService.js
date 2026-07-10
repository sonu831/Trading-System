const crypto = require('crypto');
const { getStrategy, listStrategies, secondsUntilISTMidnight, secondsUntilNextISTHour } = require('./strategies');

/**
 * Broker Session Service — centralized auth for ALL broker providers.
 *
 * The ONLY place a broker login happens. L1 (ingestion) and L10 (execution) read the
 * resulting token from Redis; they never authenticate themselves. One login, one token,
 * one refresh loop, one audit trail.
 *
 * Broker auth flows are not the same shape, so this service knows only three outcomes and
 * delegates the specifics to a strategy (see `strategies/base.js`):
 *
 *   connected    -> cache the token for the strategy's TTL
 *   needs_input  -> a value must come from a human (MStock OTP, Kite request_token).
 *                   The interim state is parked in Redis; `completeSession()` finishes it.
 *   error        -> nothing is cached, ever. A failed login must never look connected.
 */

const PENDING_KEY = (p) => `broker:pending:${p}`;

let OTPAuth = null;

/**
 * Normalise a pasted TOTP secret to canonical Base32.
 *
 * `otpauth` already tolerates lowercase, spaces and `=` padding, but THROWS on hyphens,
 * on `0`/`1`, and on hex strings. Falling back to "treat the raw bytes as the secret"
 * (as this once did) is worse than throwing: it produces a valid-looking but WRONG
 * 6-digit code, and the broker reports "Please enter correct TOTP" — sending you to
 * debug the clock instead of the secret. Fail loudly on a malformed secret.
 */
function normalizeBase32Secret(raw) {
  let s = String(raw ?? '').trim();
  if (!s) throw new Error('totp_secret is empty');

  // Accept a pasted otpauth:// provisioning URI.
  if (/^otpauth:\/\//i.test(s)) {
    const m = s.match(/[?&]secret=([^&]+)/i);
    if (!m) throw new Error('totp_secret looks like an otpauth:// URI but has no `secret=` parameter');
    s = decodeURIComponent(m[1]);
  }

  s = s.replace(/[\s-]/g, '').replace(/=+$/, '').toUpperCase();

  if (!/^[A-Z2-7]+$/.test(s)) {
    throw new Error(
      'totp_secret is not valid Base32 (allowed characters: A-Z and 2-7). ' +
        'Copy the secret key shown beside the QR code on trade.mstock.com ' +
        '(Products → Trading APIs → Enable TOTP) — not the QR image, and not a hex string.'
    );
  }
  return s;
}

function generateTOTP(secret) {
  if (!OTPAuth) OTPAuth = require('otpauth');
  const base32 = normalizeBase32Secret(secret);
  return new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(base32),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  }).generate();
}

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Lazy: the auth flows must be unit-testable (with an injected `http`) without axios present.
let _axios = null;
const axiosLazy = () => (_axios ||= require('axios'));
const lazyHttp = {
  get: (...args) => axiosLazy().get(...args),
  post: (...args) => axiosLazy().post(...args),
};

class BrokerSessionService {
  constructor({ brokerService }) {
    this.brokerService = brokerService;
    // Injected so every strategy is testable without network or vendor SDKs.
    this.deps = {
      http: lazyHttp,
      generateTOTP,
      sha256,
      now: undefined, // strategies default to `new Date()`
    };
  }

  /** What the dashboard needs to render the right form for each provider. */
  listStrategies() {
    return listStrategies();
  }

  async getCredentials(provider) {
    return this.brokerService.getDecryptedCredentials(provider);
  }

  /** @returns {Promise<string|null>} the raw token, or null when absent/expired. */
  async getCachedToken(provider) {
    return this.brokerService.getSessionToken(provider);
  }

  async saveToken(provider, token, ttlSeconds) {
    return this.brokerService.saveSessionToken(provider, token, ttlSeconds);
  }

  // ── pending interactive state (request tokens etc.) ──
  async savePending(provider, pending, ttlSeconds) {
    return this.brokerService.setJson(PENDING_KEY(provider), pending, ttlSeconds);
  }
  async loadPending(provider) {
    return this.brokerService.getJson(PENDING_KEY(provider));
  }
  async clearPending(provider) {
    return this.brokerService.delKey(PENDING_KEY(provider));
  }

  /** Start (or restart) a connection. May return `needs_input`. */
  async testConnection(provider, input = null) {
    const strategy = getStrategy(provider);
    if (!strategy) {
      return { success: false, error: `Unknown provider: ${provider}. Supported: ${Object.keys(require('./strategies').STRATEGIES).join(', ')}` };
    }

    const creds = await this.getCredentials(provider);
    if (!creds) return { success: false, error: `No credentials configured for ${provider}` };

    const missing = strategy.requiredFields.filter((f) => !creds[f]);
    if (missing.length) {
      return {
        success: false,
        stage: 'credentials',
        error: `Missing required credentials for ${provider}: ${missing.join(', ')}`,
        missing,
        required: strategy.requiredFields,
      };
    }

    const pending = input ? await this.loadPending(provider) : null;
    const result = await strategy.authenticate(creds, this.deps, { input, pending });
    return this.applyResult(provider, result);
  }

  /**
   * Finish an interactive flow: `{ otp }` for MStock, `{ request_token }` for Kite.
   * Rejects inputs the strategy never asked for, so a typo can't silently no-op.
   */
  async completeSession(provider, input) {
    const strategy = getStrategy(provider);
    if (!strategy) return { success: false, error: `Unknown provider: ${provider}` };

    const supplied = Object.keys(input || {}).filter((k) => input[k]);
    const accepted = supplied.filter((k) => strategy.interactiveInputs.includes(k));
    if (!accepted.length) {
      return {
        success: false,
        stage: 'input',
        error: strategy.interactiveInputs.length
          ? `${provider} expects one of: ${strategy.interactiveInputs.join(', ')}`
          : `${provider} has no interactive login step`,
      };
    }

    return this.testConnection(provider, input);
  }

  /** Persist whatever the strategy decided — and nothing more. */
  async applyResult(provider, result) {
    if (result.status === 'needs_input') {
      await this.savePending(provider, result.pending || {}, result.pendingTtlSeconds || 300);
      const { pending, pendingTtlSeconds, ...safe } = result;
      return safe;
    }

    if (!result.success) {
      // A failed attempt must not leave a usable session behind. But a *retryable* failure
      // (e.g. a mistyped OTP) keeps the parked login, so retrying does not send a new OTP.
      if (!result.retryPending) await this.clearPending(provider);
      const { retryPending, ...safe } = result;
      return safe;
    }

    await this.clearPending(provider);

    // `token: null` is legitimate (IndianAPI): success, nothing to cache.
    if (result.token) {
      await this.saveToken(provider, result.token, result.ttlSeconds);
    }

    const { token, ttlSeconds, ...safe } = result; // never return the raw token
    return safe;
  }

  /**
   * Cached token if still valid, else re-authenticate — but ONLY when the provider can
   * authenticate unattended.
   *
   * This guard matters: MStock sends an OTP to the user's phone/email on EVERY
   * /connect/login when TOTP is not enabled. A background refresh loop that blindly
   * re-logs-in would spam real OTP messages that nobody is waiting to answer (and can
   * trip the broker's rate limits). If a human step is required, return null and let the
   * operator connect from the dashboard.
   *
   * `getCachedToken` returns a STRING (or null) and already checks expiry — do not
   * dereference `.expiresAt` on it (that re-authenticated on every call).
   */
  async getOrRefreshToken(provider) {
    const cached = await this.getCachedToken(provider);
    if (cached) return cached;

    const strategy = getStrategy(provider);
    if (!strategy) return null;

    const creds = await this.getCredentials(provider);
    if (!creds) return null;

    if (typeof strategy.canAuthenticateUnattended === 'function' && !strategy.canAuthenticateUnattended(creds)) {
      return null; // a human must complete this login; do not trigger an OTP
    }

    const result = await this.testConnection(provider);
    return result.success ? this.getCachedToken(provider) : null;
  }

  async invalidateSession(provider) {
    await this.clearPending(provider);
    return this.brokerService.clearSessionToken(provider);
  }
}

module.exports = BrokerSessionService;
module.exports.secondsUntilISTMidnight = secondsUntilISTMidnight;
module.exports.secondsUntilNextISTHour = secondsUntilNextISTHour;
module.exports.generateTOTP = generateTOTP;
module.exports.normalizeBase32Secret = normalizeBase32Secret;
