/**
 * MStock (Mirae Asset) — Type B auth strategy.
 *
 * TWO-STEP always required:
 *   1. POST /connect/login → REQUEST token (UUID, NOT trading token)
 *   2. POST /session/verifytotp → TRADING token (JWT)
 *
 * Enabling TOTP only suppresses OTP message; step 2 is always required.
 */
import type { BrokerAuthStrategy, StrategyDeps, AuthContext, AuthResult } from './base';
import { secondsUntilISTMidnight } from './base';

const BASE = 'https://api.mstock.trade/openapi/typeb';

const jsonHeaders = (apiKey?: string): Record<string, string> => {
  const h: Record<string, string> = { 'X-Mirae-Version': '1', 'Content-Type': 'application/json' };
  if (apiKey) h['X-PrivateKey'] = apiKey;
  return h;
};

const isOk = (r: any): boolean => r?.status === true || r?.status === 'true';
const errorOf = (r: any, fb: string): string => r?.message || r?.data?.message || r?.errorcode || fb;

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
    const { http } = deps;

    const otp = (ctx?.input as any)?.otp;
    const parkedRequestToken = (ctx?.pending as any)?.requestToken;

    // Interactive resume. Reuse the request token parked at step 1 and NEVER log in again:
    // a second /connect/login sends the user a second OTP and invalidates the first, so a
    // single mistyped digit would strand them in a loop of fresh codes.
    if (otp && parkedRequestToken) {
      let tokenResp: any;
      try {
        tokenResp = await http.post(`${BASE}/session/token`, { refreshToken: parkedRequestToken, otp }, { headers: jsonHeaders(api_key), timeout: 15000 });
      } catch (err: any) {
        // retryPending: keep the parked login so the user can re-enter the SAME code.
        return { success: false, error: err.response?.data?.message || err.message, stage: 'otp_verify', retryPending: true };
      }

      const body = tokenResp?.data;
      const tradingToken = body?.data?.jwtToken;
      if (!isOk(body) || !tradingToken) {
        return { success: false, error: errorOf(body, 'OTP verification failed'), stage: 'otp_verify', retryPending: true };
      }
      if (tradingToken === parkedRequestToken) {
        return { success: false, error: 'broker echoed the request token instead of a trading token', stage: 'otp_verify' };
      }

      return { success: true, status: 'connected', token: tradingToken, ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'mstock', auth_type: 'otp', stage: 'connected' };
    }

    // Step 1 — login
    let loginResp: any;
    try {
      loginResp = await http.post(`${BASE}/connect/login`, { clientcode: client_code, password, totp: '', state: '' }, { headers: jsonHeaders(), timeout: 15000 });
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || err.message, stage: 'login' };
    }

    // `http.post` resolves to an AXIOS RESPONSE. The API envelope is `resp.data`
    // ({status, message, data}); the payload is `resp.data.data`. Reading
    // `resp.data.jwtToken` is one level too shallow (undefined), and `isOk(resp)` inspects
    // the response object rather than the body. Always narrow to the body first.
    const loginBody = loginResp?.data;
    const requestToken = loginBody?.data?.jwtToken;
    if (!isOk(loginBody) || !requestToken) {
      return { success: false, error: errorOf(loginBody, 'login failed'), stage: 'login' };
    }

    // Step 2 — verify TOTP (unattended) or needs OTP (interactive)
    if (totp_secret) {
      let verifyResp: any;
      try {
        const totp = deps.generateTOTP(totp_secret);
        verifyResp = await http.post(`${BASE}/session/verifytotp`, { refreshToken: requestToken, totp }, { headers: jsonHeaders(api_key), timeout: 15000 });
      } catch (err: any) {
        return { success: false, error: err.response?.data?.message || err.message, stage: 'totp_verify' };
      }

      // Same envelope. The TRADING token comes from step 2 — caching step 1's request
      // token here is the bug that shipped twice.
      const verifyBody = verifyResp?.data;
      const tradingToken = verifyBody?.data?.jwtToken;
      if (!isOk(verifyBody) || !tradingToken) {
        return { success: false, error: errorOf(verifyBody, 'TOTP verification failed'), stage: 'totp_verify' };
      }
      // If the broker echoes step 1's request token back, it is NOT a trading session.
      // Caching it yields a token that authenticates nothing — this shipped twice.
      if (tradingToken === requestToken) {
        return { success: false, error: 'broker echoed the request token instead of a trading token', stage: 'totp_verify' };
      }

      return { success: true, status: 'connected', token: tradingToken, ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'mstock', auth_type: 'totp', stage: 'connected' };
    }

    // No TOTP secret — cannot complete unattended
    return { success: false, status: 'needs_input', stage: 'needs_otp', error: 'OTP sent to phone/email. Enter OTP to complete login.', pending: { requestToken, provider: 'mstock' }, pendingTtlSeconds: 300 };
  },
};

export = strategy;
