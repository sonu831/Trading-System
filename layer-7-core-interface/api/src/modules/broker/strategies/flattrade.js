const { isOk, errorOf, connected, needsInput, failure, secondsUntilNextISTHour } = require('./base');

const PI_API = 'https://piconnect.flattrade.in/PiConnectAPI';
const AUTH_PORTAL = 'https://auth.flattrade.in';
const AUTH_API = 'https://authapi.flattrade.in/trade/apitoken';

/**
 * FlatTrade (Pi Connect / Noren).
 *
 * A third shape again — and NOT "the API key is the token", which is what this file
 * previously assumed. Per the official docs, FlatTrade is a browser-mediated 3-legged flow:
 *
 *   1. Operator opens  https://auth.flattrade.in/?app_key=<api_key>
 *   2. FlatTrade redirects to the registered Redirect URL with `?request_code=<code>`
 *      (single-use, lives only a few minutes)
 *   3. Server exchanges it:
 *        POST https://authapi.flattrade.in/trade/apitoken
 *        { api_key, request_code, api_secret: SHA256(api_key + request_code + api_secret) }
 *        -> { status: "Ok", token, client }
 *
 *   The returned `token` is the **jKey** used by every Pi Connect call.
 *
 * Token lifetime: "valid for 24 hours ... cleared between 5 to 6 AM ... regenerate after
 * 6 AM". So the session expires at the next 06:00 IST, exactly like Kite.
 *
 * Caveat from the docs: the token is only issued when the request originates from the
 * static IP registered against the API key. A 403/!Ok here usually means the server's
 * egress IP is not the registered one.
 */
const FLATTRADE_SESSION_EXPIRY_HOUR_IST = 6;

const httpError = (err) => err.response?.data?.emsg || err.response?.data?.message || err.message;

/** Noren wire format: `jData=<json>&jKey=<token>`. */
const norenBody = (data, jKey) => `jData=${JSON.stringify(data)}&jKey=${jKey}`;

module.exports = {
  id: 'flattrade',
  label: 'FlatTrade (Pi Connect)',
  requiredFields: ['api_key'],
  optionalFields: ['api_secret', 'client_code', 'access_token'],
  interactiveInputs: ['request_code'],
  capabilities: { data: true, execution: true, restingStop: true, orderStatus: true },

  ttlSeconds: (now) => secondsUntilNextISTHour(FLATTRADE_SESSION_EXPIRY_HOUR_IST, now),

  /** Only a stored jKey (access_token) lets us connect without the browser step. */
  canAuthenticateUnattended: (creds) => !!(creds.access_token && creds.client_code),

  async authenticate(creds, deps, ctx = {}) {
    const { api_key, api_secret, client_code, access_token } = creds;
    const { http, sha256, now } = deps;

    // ── Completing the browser redirect: request_code -> jKey ──
    if (ctx.input?.request_code) {
      if (!api_secret) {
        return failure({ stage: 'exchange', error: 'api_secret is required to exchange a request_code', missing: ['api_secret'] });
      }
      const requestCode = String(ctx.input.request_code);
      // The docs name this field `api_secret`, but it carries the HASH, not the secret.
      const hashed = sha256(`${api_key}${requestCode}${api_secret}`);

      try {
        const resp = await http.post(
          AUTH_API,
          { api_key, request_code: requestCode, api_secret: hashed },
          { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
        );

        const token = resp.data?.token;
        if (!isOk(resp.data) || !token) {
          return failure({
            stage: 'exchange',
            error: errorOf(resp.data, 'Token exchange failed'),
            hint: 'FlatTrade only issues a token when the request comes from the static IP registered against this API key.',
          });
        }
        if (token === requestCode) {
          return failure({ stage: 'exchange', error: 'Broker returned the request_code as the token' });
        }

        const ttlSeconds = secondsUntilNextISTHour(FLATTRADE_SESSION_EXPIRY_HOUR_IST, now);
        return connected({
          token, // this is the jKey
          ttlSeconds,
          meta: {
            broker: 'flattrade',
            auth_type: 'oauth_request_code',
            client: resp.data.client || client_code || null,
            expiresInSeconds: ttlSeconds,
            token_length: token.length,
          },
        });
      } catch (err) {
        return failure({ stage: 'exchange', error: httpError(err) });
      }
    }

    // ── Already hold a jKey? Probe an authenticated endpoint to prove it still works. ──
    if (access_token && client_code) {
      try {
        const resp = await http.post(`${PI_API}/UserDetails`, norenBody({ uid: client_code }, access_token), {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        });
        if (!isOk(resp.data)) {
          return failure({ stage: 'validate', error: errorOf(resp.data, 'Invalid or expired session key') });
        }
        const ttlSeconds = secondsUntilNextISTHour(FLATTRADE_SESSION_EXPIRY_HOUR_IST, now);
        return connected({
          token: access_token,
          ttlSeconds,
          meta: {
            broker: 'flattrade',
            auth_type: 'stored_token',
            user: resp.data?.uname || client_code,
            expiresInSeconds: ttlSeconds,
          },
        });
      } catch (err) {
        return failure({ stage: 'validate', error: httpError(err) });
      }
    }

    // ── Otherwise the operator must complete the browser login. ──
    if (!api_secret) {
      return failure({
        stage: 'credentials',
        error: 'Store an api_secret (to exchange a request_code), or an access_token (jKey) plus client_code.',
        missing: ['api_secret'],
      });
    }

    return needsInput({
      inputType: 'request_code',
      pending: {},
      message:
        `Open ${AUTH_PORTAL}/?app_key=${api_key}, log in with your Client ID (UCC), password and PAN/DOB, ` +
        'then paste the `request_code` from the redirect URL. It is single-use and expires within minutes.',
    });
  },
};
