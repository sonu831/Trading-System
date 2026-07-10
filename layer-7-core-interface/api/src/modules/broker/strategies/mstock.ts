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

    // Step 1 — login
    let loginResp: any;
    try {
      loginResp = await http.post(`${BASE}/connect/login`, { clientcode: client_code, password, totp: '', state: '' }, { headers: jsonHeaders(), timeout: 15000 });
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || err.message, stage: 'login' };
    }

    const requestToken = loginResp?.data?.jwtToken;
    if (!isOk(loginResp) || !requestToken) {
      return { success: false, error: errorOf(loginResp, 'login failed'), stage: 'login' };
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

      const tradingToken = verifyResp?.data?.jwtToken;
      if (!isOk(verifyResp) || !tradingToken) {
        return { success: false, error: errorOf(verifyResp, 'TOTP verification failed'), stage: 'totp_verify' };
      }

      return { success: true, status: 'connected', token: tradingToken, ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'mstock', auth_type: 'totp', stage: 'connected' };
    }

    // No TOTP secret — cannot complete unattended
    return { success: false, status: 'needs_input', stage: 'needs_otp', error: 'OTP sent to phone/email. Enter OTP to complete login.', pending: { requestToken, provider: 'mstock' }, pendingTtlSeconds: 300 };
  },
};

export = strategy;
