const FLATTRADE_BASE_URL = 'https://piconnect.flattrade.in/PiConnectAPI';

/**
 * Build the Noren wire body.
 * Format: `jData=<JSON>&jKey=<session token>`
 * Content-Type MUST be `application/json` (not text/plain).
 *
 * @param {object} data      Payload (uid, exch, token, etc.)
 * @param {string} jKey      Session token from the login flow — NEVER the api_key.
 * @returns {string}
 */
function norenBody(data, jKey) {
  if (!jKey) throw new Error('norenBody: jKey (session token) is required');
  return `jData=${JSON.stringify(data)}&jKey=${encodeURIComponent(jKey)}`;
}

/**
 * Check whether a Noren response indicates success.
 * Success may be an OBJECT with `stat:'Ok'` OR an ARRAY (OrderBook, SingleOrdHist).
 * An array response is always success; a list failure returns an error object instead.
 */
function isNorenOk(payload) {
  if (!payload) return false;
  if (Array.isArray(payload)) return true;
  return payload.stat === 'Ok';
}

/**
 * Extract a human-readable error string from a Noren failure response.
 */
function norenError(payload, fallback) {
  if (!payload) return fallback || 'No response';
  if (payload.emsg) return payload.emsg;
  if (payload.stat && payload.stat !== 'Ok') return `stat=${payload.stat}`;
  return fallback || JSON.stringify(payload);
}

module.exports = { FLATTRADE_BASE_URL, norenBody, isNorenOk, norenError };
