const { isOk, errorOf, connected, needsInput, failure, secondsUntilNextISTHour } = require('./base');

const KITE_API = 'https://api.kite.trade';
const KITE_LOGIN = 'https://kite.zerodha.com/connect/login';

/**
 * Kite / Zerodha (Kite Connect v3).
 *
 * The shape that MStock's flow cannot express: Kite is a 3-legged, browser-mediated login.
 *
 *   1. Operator visits  https://kite.zerodha.com/connect/login?v=3&api_key=<key>
 *   2. Zerodha redirects back with a one-time `request_token`
 *   3. Server exchanges it:
 *        checksum = SHA256(api_key + request_token + api_secret)
 *        POST /session/token  (form-encoded: api_key, request_token, checksum)
 *        -> data.access_token
 *
 * Auth on subsequent calls: `Authorization: token <api_key>:<access_token>`, `X-Kite-Version: 3`.
 *
 * There is no unattended path: `request_token` is single-use and only obtainable through the
 * browser redirect. If an `access_token` is already stored we validate and reuse it instead.
 *
 * NOTE: Kite invalidates sessions each morning. We expire the cached token at the next
 * 06:00 IST. VERIFY this hour against the current Kite Connect docs before relying on it.
 */
const KITE_SESSION_EXPIRY_HOUR_IST = 6;

const authHeader = (apiKey, accessToken) => ({
  'X-Kite-Version': '3',
  Authorization: `token ${apiKey}:${accessToken}`,
});

const httpError = (err) => err.response?.data?.message || err.message;

async function validateAccessToken(http, apiKey, accessToken, now) {
  const resp = await http.get(`${KITE_API}/user/profile`, {
    headers: authHeader(apiKey, accessToken),
    timeout: 10000,
  });
  if (!isOk(resp.data)) {
    return failure({ stage: 'validate', error: errorOf(resp.data, 'Invalid access token') });
  }
  const ttlSeconds = secondsUntilNextISTHour(KITE_SESSION_EXPIRY_HOUR_IST, now);
  return connected({
    token: accessToken,
    ttlSeconds,
    meta: {
      broker: 'kite',
      auth_type: 'access_token',
      user: resp.data?.data?.user_name || null,
      expiresInSeconds: ttlSeconds,
      token_length: accessToken.length,
    },
  });
}

module.exports = {
  id: 'kite',
  label: 'Zerodha Kite Connect',
  requiredFields: ['api_key'],
  optionalFields: ['api_secret', 'access_token'],
  interactiveInputs: ['request_token'],
  capabilities: { data: true, execution: true, restingStop: true, orderStatus: true },

  ttlSeconds: (now) => secondsUntilNextISTHour(KITE_SESSION_EXPIRY_HOUR_IST, now),

  /** A `request_token` only comes from a browser redirect — never unattended. */
  canAuthenticateUnattended: (creds) => !!creds.access_token,

  async authenticate(creds, deps, ctx = {}) {
    const { api_key, api_secret, access_token } = creds;
    const { http, sha256, now } = deps;

    // ── Completing the browser redirect: exchange request_token -> access_token ──
    if (ctx.input?.request_token) {
      if (!api_secret) {
        return failure({ stage: 'exchange', error: 'api_secret is required to exchange a request_token' });
      }
      const requestToken = String(ctx.input.request_token);
      const checksum = sha256(`${api_key}${requestToken}${api_secret}`);

      try {
        const body = new URLSearchParams({ api_key, request_token: requestToken, checksum }).toString();
        const resp = await http.post(`${KITE_API}/session/token`, body, {
          headers: { 'X-Kite-Version': '3', 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        });

        const accessToken = resp.data?.data?.access_token;
        if (!isOk(resp.data) || !accessToken) {
          return failure({ stage: 'exchange', error: errorOf(resp.data, 'Token exchange failed') });
        }
        // A request_token is single-use; it must never be mistaken for the access token.
        if (accessToken === requestToken) {
          return failure({ stage: 'exchange', error: 'Broker returned the request_token as the access token' });
        }

        const ttlSeconds = secondsUntilNextISTHour(KITE_SESSION_EXPIRY_HOUR_IST, now);
        return connected({
          token: accessToken,
          ttlSeconds,
          meta: {
            broker: 'kite',
            auth_type: 'oauth_request_token',
            user: resp.data.data.user_name || null,
            expiresInSeconds: ttlSeconds,
            token_length: accessToken.length,
          },
        });
      } catch (err) {
        return failure({ stage: 'exchange', error: httpError(err) });
      }
    }

    // ── Already have an access token? Validate and reuse. ──
    if (access_token) {
      try {
        return await validateAccessToken(http, api_key, access_token, now);
      } catch (err) {
        return failure({ stage: 'validate', error: httpError(err) });
      }
    }

    // ── Otherwise we need the operator to complete the browser login. ──
    if (!api_secret) {
      return failure({
        stage: 'credentials',
        error: 'Store an access_token, or an api_secret so a request_token can be exchanged.',
        missing: ['access_token', 'api_secret'],
      });
    }

    return needsInput({
      inputType: 'request_token',
      pending: {},
      message:
        `Open ${KITE_LOGIN}?v=3&api_key=${api_key}, log in, then paste the ` +
        '`request_token` from the redirect URL. It is single-use and expires quickly.',
    });
  },
};
