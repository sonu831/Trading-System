/**
 * FlatTrade (Pi Connect / Noren) — browser-mediated 3-legged auth.
 *
 * Not "API key is the token" — that was wrong.
 * Official flow: browser redirect → request_code → exchange for token.
 */
import type { BrokerAuthStrategy, StrategyDeps, AuthContext, AuthResult } from './base';
import { secondsUntilNextISTHour } from './base';

/* eslint-disable @typescript-eslint/no-var-requires */
// URLs come from shared/constants.js (rule 3/14) — this file previously hardcoded
// `/PiConnectTP`, which the shared constant explicitly flags as WRONG (`/PiConnectAPI`).
// Fail closed: an unresolvable constant must refuse to construct, never fall back to a guess.
let BROKER_BASE_URLS: Record<string, string> | null = null;
try { BROKER_BASE_URLS = require('/app/shared/constants').BROKER_BASE_URLS; } catch (_) {
  try { BROKER_BASE_URLS = require('../../../../../../shared/constants').BROKER_BASE_URLS; } catch (_e) { BROKER_BASE_URLS = null; }
}
if (!BROKER_BASE_URLS?.FLATTRADE || !BROKER_BASE_URLS?.FLATTRADE_AUTH || !BROKER_BASE_URLS?.FLATTRADE_PORTAL) {
  throw new Error('shared/constants.js BROKER_BASE_URLS.FLATTRADE* not resolvable — FlatTrade strategy cannot start');
}
const API_BASE = BROKER_BASE_URLS.FLATTRADE;        // https://piconnect.flattrade.in/PiConnectAPI
const AUTH_API = BROKER_BASE_URLS.FLATTRADE_AUTH;   // https://authapi.flattrade.in/trade/apitoken
const PORTAL = BROKER_BASE_URLS.FLATTRADE_PORTAL;   // https://auth.flattrade.in

// Noren wire format (`jData=…&jKey=…`). Shared, because L1 already had it and this layer did not —
// so FlatTrade auth posted raw JSON and the broker answered "Invalid Input : jData is Missing."
let NOREN: any = null;
try { NOREN = require('/app/shared/noren'); } catch (_) {
  try { NOREN = require('../../../../../../shared/noren'); } catch (_e) { NOREN = null; }
}
if (!NOREN?.norenBody) {
  throw new Error('shared/noren.js not resolvable — FlatTrade strategy cannot start');
}
const { norenBody, isNorenOk, norenError } = NOREN;

// FlatTrade tokens live ~24h and the broker clears them between 05:00-06:00 IST.
// Cache until the next 06:00 IST — NOT the next clock hour. FlatTrade cannot re-authenticate
// unattended (canAuthenticateUnattended === false), so an hourly TTL silently forced the
// operator to redo the browser login every hour of the trading day.
const TOKEN_RESET_HOUR_IST = 6;

const strategy: BrokerAuthStrategy = {
  id: 'flattrade', label: 'FlatTrade (Pi Connect)',
  requiredFields: ['api_key'], optionalFields: ['api_secret', 'client_code'],
  interactiveInputs: ['request_code'],
  capabilities: { data: true, execution: true, restingStop: true, orderStatus: true },

  ttlSeconds: (now: Date) => secondsUntilNextISTHour(TOKEN_RESET_HOUR_IST, now || new Date()),

  canAuthenticateUnattended(): boolean { return false; },

  async authenticate(creds: Record<string, string>, deps: StrategyDeps, ctx: AuthContext): Promise<AuthResult> {
    const { api_key, api_secret, access_token, client_code } = creds;
    const { http } = deps;

    // Pre-generated jKey — validate it, no browser step needed
    if (access_token) {
      // A jKey is ~24+ chars. A short value here is almost always something else pasted by
      // mistake (a PIN, an OTP, a placeholder) — reject it rather than sending it to the broker
      // and reporting the resulting "invalid jKey" as if the token were merely stale.
      if (access_token.trim().length < 12) {
        return {
          success: false,
          stage: 'credentials',
          error: `access_token looks too short to be a FlatTrade jKey (${access_token.trim().length} chars). The jKey comes from the login flow — it is NOT the api_key, a PIN, or an OTP. Leave it blank to use the browser login instead.`,
        };
      }

      try {
        // Noren speaks `jData=<json>&jKey=<token>` — NOT a JSON body. Posting JSON gets you
        // `Invalid Input : jData is Missing.`, which reads like our payload is wrong when in fact
        // the whole wire format is. (L1 already knew this; this layer did not — hence shared/noren.js.)
        const resp = await http.post(
          `${API_BASE}/UserDetails`,
          norenBody({ uid: client_code || '', actid: client_code || '' }, access_token),
          { timeout: 10000, headers: { 'Content-Type': 'application/json' } },
        );

        if (isNorenOk(resp.data)) {
          return { success: true, status: 'connected', token: access_token,
            ttlSeconds: strategy.ttlSeconds(deps.now || new Date()), provider: 'flattrade', auth_type: 'access_token', user: resp.data?.uname };
        }
        return { success: false, error: norenError(resp.data), stage: 'validate' };
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
        error: `Open ${PORTAL}/?app_key=${api_key} and provide the request_code.`,
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
