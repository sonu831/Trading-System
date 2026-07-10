/**
 * MStock (Mirae Asset) — Type B auth strategy.
 *
 * TWO-STEP always required:
 *   1. adapter.login()   → REQUEST token (UUID, NOT trading token)
 *   2. adapter.verifyTOTP() or adapter.verifyOTP() → TRADING token (JWT)
 *
 * Enabling TOTP only suppresses OTP message; step 2 is always required.
 *
 * Transport is delegated to BrokerAdapter (adapter pattern — one wrapper per broker).
 * The strategy owns the flow; the adapter owns the HTTP/SDK layer.
 */
import type { BrokerAuthStrategy, StrategyDeps, AuthContext, AuthResult } from './base';
import { secondsUntilISTMidnight } from './base';
import { getAdapter } from '../adapters';

const strategy: BrokerAuthStrategy = {
  id: 'mstock',
  label: 'mStock (Mirae Asset)',
  requiredFields: ['api_key', 'client_code', 'password'],
  optionalFields: ['totp_secret', 'access_token'],
  interactiveInputs: ['otp'],
  capabilities: { data: true, execution: true, restingStop: false, orderStatus: false },

  ttlSeconds: secondsUntilISTMidnight,

  canAuthenticateUnattended(creds: Record<string, string>): boolean {
    return !!creds.totp_secret;
  },

  async authenticate(creds: Record<string, string>, deps: StrategyDeps, ctx: AuthContext): Promise<AuthResult> {
    const { api_key, client_code, password, totp_secret } = creds;
    const adapter = deps.adapter || getAdapter('mstock', api_key);
    if (!adapter) return { success: false, error: 'MStock adapter not available', stage: 'adapter' };

    const TTL = strategy.ttlSeconds(deps.now || new Date());
    const otp = (ctx?.input as any)?.otp;
    const parkedRequestToken = (ctx?.pending as any)?.requestToken;

    // Interactive resume. Reuse parked login from step 1 — re-logging in
    // sends a second OTP and invalidates the first.
    if (otp && parkedRequestToken) {
      return verifyOTPStep(adapter, parkedRequestToken, otp, TTL);
    }

    // Step 1 — login (always with empty TOTP; SDK attaches api_key to headers)
    return loginAndVerify(adapter, { clientcode: client_code, password }, totp_secret, TTL, deps);
  },
};

async function verifyOTPStep(adapter: any, requestToken: string, otp: string, TTL: number): Promise<AuthResult> {
  try {
    const result = await adapter.verifyOTP(requestToken, otp);
    if (!result?.jwtToken) {
      return { success: false, error: 'OTP verification returned no trading token', stage: 'otp_verify', retryPending: true };
    }
    if (result.jwtToken === requestToken) {
      return { success: false, error: 'broker echoed the request token instead of a trading token', stage: 'otp_verify' };
    }
    return { success: true, status: 'connected', token: result.jwtToken, ttlSeconds: TTL, provider: 'mstock', auth_type: 'otp', stage: 'connected' };
  } catch (err: any) {
    return { success: false, error: err.message, stage: 'otp_verify', retryPending: true };
  }
}

async function loginAndVerify(
  adapter: any,
  creds: { clientcode: string; password: string },
  totp_secret: string | undefined,
  TTL: number,
  deps: StrategyDeps,
): Promise<AuthResult> {
  // Step 1 — login
  let requestToken: string;
  try {
    const loginResult = await adapter.login({ clientcode: creds.clientcode, password: creds.password, totp: '', state: '' });
    requestToken = loginResult.jwtToken;
  } catch (err: any) {
    return { success: false, error: err.message, stage: 'login' };
  }

  // Step 2a — TOTP (unattended)
  if (totp_secret) {
    let totp: string;
    try {
      totp = deps.generateTOTP(totp_secret);
    } catch (genErr: any) {
      return { success: false, error: genErr.message, stage: 'totp_secret' };
    }

    try {
      const verifyResult = await adapter.verifyTOTP(requestToken, totp);
      if (!verifyResult?.jwtToken) {
        return { success: false, error: 'TOTP verification returned no trading token', stage: 'totp_verify' };
      }
      if (verifyResult.jwtToken === requestToken) {
        return { success: false, error: 'broker echoed the request token instead of a trading token', stage: 'totp_verify' };
      }
      return { success: true, status: 'connected', token: verifyResult.jwtToken, ttlSeconds: TTL, provider: 'mstock', auth_type: 'totp', stage: 'connected' };
    } catch (err: any) {
      return { success: false, error: err.message, stage: 'totp_verify' };
    }
  }

  // Step 2b — needs OTP (interactive)
  return {
    success: false,
    status: 'needs_input',
    stage: 'needs_otp',
    error: 'OTP sent to phone/email. Enter OTP to complete login.',
    pending: { requestToken, provider: 'mstock' },
    pendingTtlSeconds: 300,
  };
}

module.exports = strategy;
