/**
 * Noren wire format — FlatTrade (Pi Connect) and any other Noren/Shoonya-derived OMS.
 *
 * Noren does NOT accept a JSON body. Every PiConnectAPI call must be posted as:
 *
 *     jData=<JSON payload>&jKey=<session token>
 *
 * Post plain JSON and the broker answers `Invalid Input : jData is Missing.` — which reads like a
 * missing field in *our* payload and sends you hunting the wrong thing. This lived only inside
 * layer-1; layer-7's broker strategy posted raw JSON and could never authenticate. Declared once
 * here so a fix in one layer cannot leave the other broken (rules 3/14).
 *
 * NOTE: this applies to `piconnect.flattrade.in/PiConnectAPI` only. The token-exchange endpoint
 * (`authapi.flattrade.in/trade/apitoken`) is a different service and DOES take a normal JSON body.
 *
 * Used by: L1 (ingestion), L7 (broker auth), L10 (execution)
 */

/**
 * Build the Noren wire body.
 * @param {object} data Payload (uid, exch, token, …)
 * @param {string} jKey Session token from the login flow — NEVER the api_key.
 * @returns {string}
 */
function norenBody(data, jKey) {
  if (!jKey) throw new Error('norenBody: jKey (session token) is required');
  return `jData=${JSON.stringify(data)}&jKey=${encodeURIComponent(jKey)}`;
}

/**
 * Did a Noren response succeed?
 * Success is either an object with `stat: 'Ok'` OR a bare array (OrderBook, SingleOrdHist, …).
 * A list *failure* comes back as an error object, never an array — so an array is always success.
 */
function isNorenOk(payload) {
  if (!payload) return false;
  if (Array.isArray(payload)) return true;
  return payload.stat === 'Ok';
}

/** Human-readable error from a Noren failure response. */
function norenError(payload) {
  if (!payload) return 'empty response';
  return payload.emsg || payload.message || `unexpected response: ${JSON.stringify(payload).slice(0, 200)}`;
}

module.exports = { norenBody, isNorenOk, norenError };
