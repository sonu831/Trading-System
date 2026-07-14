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

let authLog: any = null;
try { authLog = require('../../../../shared/auth-logger').authLog.mstock; } catch (_) { /* shared module not mounted */ }
const log = (level: string, msg: string, data?: any) => {
  if (authLog?.[level]) return authLog[level](msg, data);
  const ts = new Date().toISOString();
  const line = data ? `[mstock-auth ${ts}] ${msg} ${JSON.stringify(data)}` : `[mstock-auth ${ts}] ${msg}`;
  console.log(line);
};

const strategy: BrokerAuthStrategy = {
  id: 'mstock',
  label: 'mStock (Mirae Asset)',
  requiredFields: ['api_key', 'client_code', 'password'],
  optionalFields: ['totp_secret', 'access_token'],
  interactiveInputs: ['otp', 'totp'],
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
    const directTOTP = (ctx?.input as any)?.totp;  // user-provided TOTP code from authenticator app
    const parkedRequestToken = (ctx?.pending as any)?.requestToken;

    // Interactive resume: OTP step 2 (reuse parked login from step 1)
    if (otp && parkedRequestToken) {
      return verifyOTPStep(adapter, parkedRequestToken, otp, TTL);
    }

    // Direct login: user provided a 6-digit TOTP code — pass to SDK login in one shot.
    // This is the standard SDK pattern: client.login({ totp: "776395" }) → JWT directly.
    if (directTOTP && /^\d{6}$/.test(directTOTP)) {
      return directLogin(adapter, { clientcode: client_code, password }, directTOTP, TTL);
    }

    // Standard two-step flow (with or without Base32 secret for unattended auth)
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
  log('start', 'loginAndVerify', { clientcode: creds.clientcode, has_totp_secret: !!totp_secret });

  // Path A — TOTP unattended: two-step flow.
  //   1. login({ totp: '' })        → request token  (no OTP sent if TOTP is enabled)
  //   2. verifyTOTP(requestToken)   → trading JWT     (valid for REST + WebSocket)
  // One-step login gives a session-only token that MStock rejects for REST calls.
  if (totp_secret) {
    let totp: string;
    try {
      totp = deps.generateTOTP(totp_secret);
    } catch (genErr: any) {
      log('fail', 'TOTP generation FAILED', { error: genErr.message });
      return { success: false, error: genErr.message, stage: 'totp_secret' };
    }

    // Step 1 — login without TOTP (returns request token, no OTP when TOTP is enabled)
    let requestToken: string;
    try {
      log('step', 'Step 1: adapter.login({ totp: "" })');
      const loginResult = await adapter.login({ clientcode: creds.clientcode, password: creds.password, totp: '', state: '' });
      requestToken = loginResult.jwtToken;
      log('ok', 'Got request token', { token_len: requestToken.length });
    } catch (err: any) {
      log('fail', 'Step 1 login FAILED', { error: err.message });
      return { success: false, error: err.message, stage: 'login' };
    }

    // Step 2 — verify TOTP to get the TRADING token
    try {
      log('step', 'Step 2: adapter.verifyTOTP(requestToken, totp)');
      const tradingResult = await adapter.verifyTOTP(requestToken, totp);
      if (!tradingResult?.jwtToken) {
        return { success: false, error: 'TOTP verification returned no trading token', stage: 'totp_verify' };
      }
      if (tradingResult.jwtToken === requestToken) {
        return { success: false, error: 'broker echoed request token instead of trading token', stage: 'totp_verify' };
      }
      log('ok', 'TOTP auth SUCCESS — trading JWT', { jwt_len: tradingResult.jwtToken.length });
      return { success: true, status: 'connected', token: tradingResult.jwtToken, ttlSeconds: TTL, provider: 'mstock', auth_type: 'totp', stage: 'connected' };
    } catch (err: any) {
      log('fail', 'Step 2 verifyTOTP FAILED', { error: err.message });
      return { success: false, error: err.message, stage: 'totp_verify', likelyCauses: [
        'TOTP may not be enabled — Enable TOTP at trade.mstock.com → Trading APIs',
        'The Base32 secret may not match — regenerate and re-enter',
        'Clock skew >30s produces wrong codes — sync time',
      ]};
    }
  }

  // Path B — no TOTP: login with empty TOTP → request token → prompt for OTP.
  let requestToken: string;
  try {
    log('step', 'adapter.login({ totp: "" }) — interactive path');
    const loginResult = await adapter.login({ clientcode: creds.clientcode, password: creds.password, totp: '', state: '' });
    requestToken = loginResult.jwtToken;
    log('ok', 'Got request token for OTP', { token_len: requestToken.length });
  } catch (err: any) {
    log('fail', 'Login FAILED', { error: err.message });
    return { success: false, error: err.message, stage: 'login' };
  }

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

async function directLogin(
  adapter: any,
  creds: { clientcode: string; password: string },
  totp: string,
  TTL: number,
): Promise<AuthResult> {
  log('start', 'directLogin — one-step SDK login with TOTP code', { clientcode: creds.clientcode, totp_len: totp.length });
  try {
    log('step', 'Calling adapter.login({ totp: "******" }) — direct SDK flow');
    const result = await adapter.login({ clientcode: creds.clientcode, password: creds.password, totp, state: 'live' });
    log('ok', 'directLogin — JWT received', { jwt_len: result.jwtToken?.length || 0 });
    if (!result?.jwtToken) {
      return { success: false, error: 'Direct login returned no trading token', stage: 'login' };
    }
    return { success: true, status: 'connected', token: result.jwtToken, ttlSeconds: TTL, provider: 'mstock', auth_type: 'totp_direct', stage: 'connected' };
  } catch (err: any) {
    log('fail', 'directLogin FAILED', { error: err.message });
    return { success: false, error: err.message, stage: 'login' };
  }
}
