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
  log('start', 'loginAndVerify', { clientcode: creds.clientcode, has_totp_secret: !!totp_secret, totp_secret_len: totp_secret?.length || 0 });

  // Step 1 — login
  let requestToken: string;
  try {
    log('step', 'Step 1: calling adapter.login()');
    const loginResult = await adapter.login({ clientcode: creds.clientcode, password: creds.password, totp: '', state: '' });
    requestToken = loginResult.jwtToken;
    log('ok', 'Step 1: login OK — got request token', { token_len: requestToken.length, is_uuid: requestToken.includes('-') });
  } catch (err: any) {
    log('fail', 'Step 1: login FAILED', { error: err.message });
    return { success: false, error: err.message, stage: 'login' };
  }

  // Step 2a — TOTP (unattended)
  if (totp_secret) {
    // E6: Check clock skew before generating TOTP (30s tolerance)
    try {
      const serverStart = Date.now();
      const serverResp = await deps.http.get('https://api.mstock.trade/api/server-time', { timeout: 3000 });
      const serverTimeMs = serverResp?.data?.time ? new Date(serverResp.data.time).getTime() : serverStart;
      const skew = Math.abs(serverTimeMs - serverStart);
      if (skew > 30000) {
        log('fail', `Clock skew detected: ${(skew/1000).toFixed(1)}s`, { local: new Date(serverStart).toISOString(), server: new Date(serverTimeMs).toISOString() });
        return { success: false, error: `System clock is ${(skew/1000).toFixed(0)}s off broker time — TOTP code would be wrong. Sync system time.`, stage: 'clock_skew', serverTimeUtc: new Date(serverTimeMs).toISOString() };
      }
    } catch (_) { /* time check best-effort — proceed with local clock */ }
    log('step', 'Step 2a: TOTP path — generating code');
    let totp: string;
    try {
      totp = deps.generateTOTP(totp_secret);
      log('ok', 'TOTP code generated', { code_len: totp.length, code_preview: totp.slice(0, 1) + '*****' });
    } catch (genErr: any) {
      log('fail', 'TOTP generation FAILED', { error: genErr.message, secret_len: totp_secret.length, first_char: totp_secret[0] });
      return { success: false, error: genErr.message, stage: 'totp_secret' };
    }

    try {
      log('step', 'Step 2b: calling adapter.verifyTOTP()');
      const verifyResult = await adapter.verifyTOTP(requestToken, totp);
      log('ok', 'verifyTOTP response', { has_jwt: !!verifyResult?.jwtToken, jwt_len: verifyResult?.jwtToken?.length || 0, is_same_as_request: verifyResult?.jwtToken === requestToken });
      if (!verifyResult?.jwtToken) {
        return { success: false, error: 'TOTP verification returned no trading token', stage: 'totp_verify' };
      }
      if (verifyResult.jwtToken === requestToken) {
        return { success: false, error: 'broker echoed the request token instead of a trading token', stage: 'totp_verify' };
      }
      log('ok', 'TOTP auth SUCCESS — got JWT', { jwt_len: verifyResult.jwtToken.length });
      return { success: true, status: 'connected', token: verifyResult.jwtToken, ttlSeconds: TTL, provider: 'mstock', auth_type: 'totp', stage: 'connected' };
    } catch (err: any) {
      log('fail', 'verifyTOTP FAILED', { error: err.message });
      const statusCode = err?.response?.status;
      const serverTimeUtc = err?.serverTimeUtc || new Date().toISOString();
      const likelyCauses = [
        'TOTP may not be enabled on the account — Enable TOTP in trade.mstock.com → Trading APIs',
        'The secret may not match (regenerate and re-enter the Base32 key)',
        'A significant clock skew can produce a wrong code — check server time',
      ];
      const stageName = statusCode === 400 ? 'verify_totp' : 'totp_verify';
      return { success: false, error: err.message, stage: stageName, serverTimeUtc, likelyCauses };
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
