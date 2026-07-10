const FLATTRADE_BASE_URL = 'https://piconnect.flattrade.in/PiConnectAPI';

function norenBody(data, jKey) {
  if (!jKey) throw new Error('norenBody: jKey (session token) is required');
  return `jData=${JSON.stringify(data)}&jKey=${encodeURIComponent(jKey)}`;
}

function isNorenOk(payload) {
  if (!payload) return false;
  if (Array.isArray(payload)) return true;
  return payload.stat === 'Ok';
}

function norenError(payload, fallback) {
  if (!payload) return fallback || 'No response';
  if (payload.emsg) return payload.emsg;
  if (payload.stat && payload.stat !== 'Ok') return `stat=${payload.stat}`;
  return fallback || JSON.stringify(payload);
}

module.exports = { FLATTRADE_BASE_URL, norenBody, isNorenOk, norenError };
