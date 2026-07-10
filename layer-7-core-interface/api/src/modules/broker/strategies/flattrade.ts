/**
 * FlatTrade (Pi Connect / Noren) — browser-mediated 3-legged auth.
 *
 * Not "API key is the token" — that was wrong.
 * Official flow: browser redirect → request_code → exchange for token.
 */
import type { BrokerAuthStrategy, StrategyDeps, AuthContext, AuthResult } from './base';
import { secondsUntilNextISTHour } from './base';

const AUTH_API = 'https://authapi.flattrade.in/trade/apitoken';

const strategy: BrokerAuthStrategy = {
  id: 'flattrade', label: 'FlatTrade (Pi Connect)',
  requiredFields: ['api_key'], optionalFields: ['api_secret', 'client_code'],
  interactiveInputs: ['request_code'],
  capabilities: { data: true, execution: true, restingStop: true, orderStatus: true },

  ttlSeconds: secondsUntilNextISTHour,

  canAuthenticateUnattended(): boolean { return false; },

  async authenticate(creds: Record<string, string>, deps: StrategyDeps, ctx: AuthContext): Promise<AuthResult> {
    const { api_key, api_secret, access_token, client_code } = creds;
    const { http } = deps;

    // Pre-generated jKey — validate it, no browser step needed
    if (access_token) {
      try {
        const resp = await http.post('https://piconnect.flattrade.in/PiConnectTP/UserDetails', {
          uid: client_code || '', actid: client_code || '', susertoken: access_token, source: 'API',
        }, { timeout: 10000 });
        if (resp.data?.stat === 'Ok') {
          return { success: true, status: 'connected', token: access_token,
            ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'flattrade', auth_type: 'access_token', user: resp.data?.uname };
        }
        return { success: false, error: resp.data?.emsg || 'invalid jKey', stage: 'validate' };
      } catch (err: any) {
        return { success: false, error: err.response?.data?.emsg || err.message, stage: 'validate' };
      }
    }

    // Must have api_secret to complete the 3-legged flow
    if (!api_secret) {
      return { success: false, stage: 'credentials', error: 'FlatTrade requires an api_secret or a pre-generated access_token (jKey)' };
    }

    // Interactive flow: user must provide request_code from browser redirect
    const requestCode = ctx.input?.request_code as string;
    if (!requestCode) {
      return { success: false, status: 'needs_input', stage: 'needs_request_code',
        error: 'Open https://auth.flattrade.in/?app_key=' + api_key + ' and provide the request_code.',
        pending: { provider: 'flattrade' }, pendingTtlSeconds: 300 };
    }

    // Pending from previous call should have the request_token storage
    const checksum = deps.sha256(api_key + requestCode + (api_secret || ''));
    let tokenResp: any;
    try {
      tokenResp = await http.post(AUTH_API, { api_key, request_code: requestCode, api_secret: checksum }, { timeout: 15000 });
    } catch (err: any) {
      return { success: false, error: err.response?.data?.message || err.message, stage: 'token_exchange' };
    }

    if (tokenResp?.data?.status === 'Ok' && tokenResp.data.token) {
      return { success: true, status: 'connected', token: tokenResp.data.token,
        ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'flattrade', auth_type: 'request_code' };
    }
    return { success: false, error: tokenResp?.data?.message || 'token exchange failed', stage: 'token_exchange' };
  },
};

module.exports = strategy;
