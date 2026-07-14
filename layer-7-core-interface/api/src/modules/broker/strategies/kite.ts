/**
 * Kite / Zerodha (Kite Connect v3) — 3-legged browser login.
 * No unattended path. request_token is single-use, obtained via browser redirect.
 */
import type { BrokerAuthStrategy, StrategyDeps, AuthContext, AuthResult } from './base';
import { secondsUntilNextISTHour } from './base';

const KITE_API = 'https://api.kite.trade';

const strategy: BrokerAuthStrategy = {
  id: 'kite', label: 'Zerodha Kite',
  requiredFields: ['api_key'], optionalFields: ['api_secret', 'access_token'],
  interactiveInputs: ['request_token'],
  capabilities: { data: true, execution: true, restingStop: true, orderStatus: true },

  ttlSeconds: secondsUntilNextISTHour,

  canAuthenticateUnattended(): boolean { return false; },

  async authenticate(creds: Record<string, string>, deps: StrategyDeps, ctx: AuthContext): Promise<AuthResult> {
    const { api_key, api_secret, access_token } = creds;
    const { http } = deps;

    // Pre-generated access token — validate it
    if (access_token) {
      try {
        const resp = await http.get(`${KITE_API}/user/profile`, {
          headers: { 'X-Kite-Version': '3', Authorization: `token ${api_key}:${access_token}` }, timeout: 10000,
        });
        if (resp.data?.status === 'success') {
          return { success: true, status: 'connected', token: access_token,
            ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'kite', auth_type: 'access_token' };
        }
        return { success: false, error: resp.data?.message || 'invalid access token', stage: 'validate' };
      } catch (err: any) {
        return { success: false, error: err.response?.data?.message || err.message, stage: 'validate' };
      }
    }

    // Must have either an access_token or the api_secret to complete auth
    if (!api_secret) {
      return { success: false, stage: 'credentials', error: 'Kite requires an api_secret or a pre-generated access_token' };
    }

    // Interactive: user must get request_token from browser redirect
    const requestToken = ctx.input?.request_token as string;
    if (!requestToken) {
      return { success: false, status: 'needs_input', stage: 'needs_request_token',
        error: 'Visit https://kite.zerodha.com/connect/login?v=3&api_key=' + api_key + ' and provide request_token.',
        pending: { provider: 'kite' }, pendingTtlSeconds: 300 };
    }

    const checksum = deps.sha256(api_key + requestToken + (api_secret || ''));
    let tokenResp: any;
    try {
      tokenResp = await http.post(`${KITE_API}/session/token`, null, {
        params: { api_key, request_token: requestToken, checksum }, timeout: 15000,
      });
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || err.message, stage: 'token_exchange' };
    }

    if (tokenResp?.data?.status === 'success' && tokenResp.data.data?.access_token) {
      return { success: true, status: 'connected', token: tokenResp.data.data.access_token,
        ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'kite', auth_type: 'request_token' };
    }
    return { success: false, error: tokenResp?.data?.message || 'token exchange failed', stage: 'token_exchange' };
  },
};

module.exports = strategy;
