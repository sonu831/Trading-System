const { isOk, errorOf, connected, needsInput, failure, secondsUntilISTMidnight } = require('./base');

const BASE = 'https://api.mstock.trade/openapi/typeb';

/**
 * MStock (Mirae Asset) — Type B.
 *
 * Implemented directly against the official endpoints rather than the vendor SDK, because
 * (a) we need exact control of the required headers and (b) the SDK exposes no method for
 * the OTP branch. `layer-1-ingestion` still uses the SDK for ticks.
 *
 *   1. POST /connect/login   {clientcode, password, totp:"", state:""}
 *        headers: X-Mirae-Version: 1
 *        -> data.jwtToken = a short-lived REQUEST token (a UUID). NOT the trading token.
 *
 *   2a. TOTP enabled (unattended):
 *       POST /session/verifytotp {refreshToken: <request token>, totp: <6 digits>}
 *   2b. TOTP not enabled (interactive): an OTP is sent to phone/email.
 *       POST /session/token      {refreshToken: <request token>, otp: <code>}
 *
 *       both -> data.jwtToken = the real TRADING token (Authorization: Bearer <this>)
 *       both headers: X-Mirae-Version: 1 · X-PrivateKey: <api_key>
 *
 * Enabling TOTP only suppresses the OTP *message*; step 2 is always required.
 * Caching the step-1 token as the session token 401s every later call while the UI
 * reports "connected". That bug shipped twice — hence the explicit guard below.
 */

const jsonHeaders = (apiKey) => {
  const h = { 'X-Mirae-Version': '1', 'Content-Type': 'application/json' };
  // Login does not require X-PrivateKey; every later call does.
  if (apiKey) h['X-PrivateKey'] = apiKey;
  return h;
};

const httpError = (err) => err.response?.data?.message || err.response?.data?.error_type || err.message;

/** Shared tail for both step-2 branches. */
function finishSession(resp, requestToken, now) {
  const tradingToken = resp?.data?.jwtToken;
  if (!isOk(resp) || !tradingToken) {
    return failure({ stage: 'exchange', error: errorOf(resp, 'Session exchange failed') });
  }
  // Regression guard: the trading token must not be the request token we just exchanged.
  if (tradingToken === requestToken) {
    return failure({ stage: 'exchange', error: 'Broker returned the request token as the trading token' });
  }

  const ttlSeconds = secondsUntilISTMidnight(now);
  return connected({
    token: tradingToken,
    ttlSeconds,
    meta: {
      broker: 'mstock',
      auth_type: 'totp',
      clientId: resp.data.ClientId || null,
      clientName: resp.data.ClientName || null,
      expiresInSeconds: ttlSeconds,
      token_length: tradingToken.length, // never surface the token itself
      refresh_token: !!resp.data.refreshToken,
      feed_token: !!resp.data.feedToken,
    },
  });
}

module.exports = {
  id: 'mstock',
  label: 'MStock (Mirae Asset, Type B)',
  requiredFields: ['api_key', 'client_code', 'password'],
  optionalFields: ['totp_secret'],
  interactiveInputs: ['otp'],
  capabilities: {
    data: true,
    execution: true,
    // Order endpoints unverified against the docs; see layer-10-execution/src/oms/mstock.js
    restingStop: false,
    orderStatus: false,
  },

  ttlSeconds: (now) => secondsUntilISTMidnight(now),

  /**
   * Without a TOTP secret, `/connect/login` mails/SMSes a real OTP to the user. Never let a
   * background refresh do that — it spams the operator and can trip broker rate limits.
   */
  canAuthenticateUnattended: (creds) => !!creds.totp_secret,

  async authenticate(creds, deps, ctx = {}) {
    const { api_key, client_code, password, totp_secret } = creds;
    const { http, generateTOTP, now } = deps;

    // ── Completing an interactive OTP flow ────────────────────────────────
    if (ctx.input?.otp) {
      const requestToken = ctx.pending?.requestToken;
      if (!requestToken) {
        return failure({
          stage: 'needs_otp',
          error: 'No pending login found (it may have expired). Start the connection again.',
        });
      }
      try {
        const resp = await http.post(
          `${BASE}/session/token`,
          { refreshToken: requestToken, otp: String(ctx.input.otp) },
          { headers: jsonHeaders(api_key), timeout: 10000 }
        );
        const result = finishSession(resp.data, requestToken, now);
        // A mistyped OTP must not discard a still-valid login — re-logging in would send
        // the operator ANOTHER OTP. Keep the parked request token so they can retry.
        if (!result.success) result.retryPending = true;
        return result;
      } catch (err) {
        return failure({ stage: 'exchange', error: httpError(err), retryPending: true });
      }
    }

    // ── Step 1: login (always) ────────────────────────────────────────────
    let loginData;
    try {
      const resp = await http.post(
        `${BASE}/connect/login`,
        { clientcode: client_code, password, totp: '', state: '' },
        { headers: jsonHeaders(null), timeout: 10000 }
      );
      loginData = resp.data;
    } catch (err) {
      return failure({ stage: 'login', error: httpError(err) });
    }

    const requestToken = loginData?.data?.jwtToken;
    if (!isOk(loginData) || !requestToken) {
      return failure({ stage: 'login', error: 'Login failed: ' + errorOf(loginData, 'no token in response') });
    }

    // ── Step 2a: unattended, using the stored TOTP secret ─────────────────
    if (totp_secret) {
      // A malformed secret is a *different* problem from a rejected code. Separate the
      // two, or "bad base32" masquerades as "wrong TOTP" and sends you clock-chasing.
      let code;
      try {
        code = generateTOTP(totp_secret);
      } catch (err) {
        return failure({ stage: 'totp_secret', error: err.message });
      }

      try {
        const resp = await http.post(
          `${BASE}/session/verifytotp`,
          { refreshToken: requestToken, totp: code },
          { headers: jsonHeaders(api_key), timeout: 10000 }
        );
        return finishSession(resp.data, requestToken, now);
      } catch (err) {
        const brokerMsg = httpError(err);
        // The broker only ever says "Please enter correct TOTP". Say what to check.
        if (/totp/i.test(brokerMsg)) {
          return failure({
            stage: 'verify_totp',
            error: `${brokerMsg} — the broker rejected our generated code.`,
            serverTimeUtc: new Date().toISOString(),
            likelyCauses: [
              'TOTP is not actually enabled on the mStock account (trade.mstock.com → Products → Trading APIs → Enable TOTP). If it is off, no TOTP will ever be accepted — use the OTP flow instead by removing `totp_secret`.',
              'The stored `totp_secret` is not the same secret the authenticator app uses. Re-copy the Base32 key shown beside the QR code.',
              'Server clock skew: TOTP codes are valid for 30s. Compare `serverTimeUtc` with real time; containers on Windows/WSL2 drift after sleep.',
            ],
          });
        }
        return failure({ stage: 'verify_totp', error: brokerMsg });
      }
    }

    // ── Step 2b: interactive. The OTP is out-of-band; ask the operator. ────
    return needsInput({
      inputType: 'otp',
      pending: { requestToken },
      message:
        'An OTP was sent to your registered mobile/email. Enter it to finish connecting. ' +
        'To connect unattended in future, enable TOTP on trade.mstock.com ' +
        '(Products → Trading APIs → Enable TOTP) and save the secret as `totp_secret`.',
    });
  },
};
