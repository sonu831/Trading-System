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
  const base32 = normalizeBase32Secret(secret);
  return new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(base32),
    algorithm: 'SHA1', digits: 6, period: 30,
  }).generate();
}

interface BrokerService {
  getDecryptedCredentials(provider: string): Promise<Record<string, string> | null>;
  getSessionToken(provider: string): Promise<string | null>;
  saveSessionToken(provider: string, token: string, ttl: number): Promise<void>;
  clearSessionToken(provider: string): Promise<void>;
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
    const missing = (strategy.requiredFields as string[]).filter((f: string) => !creds[f]);
    if (missing.length) {
      return { success: false, stage: 'credentials', error: `Missing: ${missing.join(', ')}`, pending: { missing, required: strategy.requiredFields } };
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

  private async applyResult(provider: string, result: AuthResult): Promise<AuthResult> {
    if (result.status === 'needs_input') {
      await this.savePending(provider, result.pending || {}, result.pendingTtlSeconds || 300);
      const { pending, pendingTtlSeconds, ...safe } = result;
      return safe;
    }
    if (!result.success) {
      await this.clearPending(provider);
      return result;
    }
    await this.clearPending(provider);
    if (result.token) {
      await this.saveToken(provider, result.token, result.ttlSeconds || 21000);
    }
    const { token, ttlSeconds, ...safe } = result;
    return safe;
  }

  async getOrRefreshToken(provider: string): Promise<string | null> {
    const cached = await this.getCachedToken(provider);
    if (cached) return cached;
    const result = await this.testConnection(provider);
    return result.success ? this.getCachedToken(provider) : null;
  }

  async invalidateSession(provider: string): Promise<void> {
    await this.clearPending(provider);
    return this.brokerService.clearSessionToken(provider);
  }
}

module.exports = BrokerSessionService;
module.exports.secondsUntilISTMidnight = secondsUntilISTMidnight;
module.exports.secondsUntilNextISTHour = secondsUntilISTHour;
module.exports.generateTOTP = generateTOTP;
