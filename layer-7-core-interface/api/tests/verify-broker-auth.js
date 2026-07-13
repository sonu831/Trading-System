/**
 * Broker auth strategies — contract + per-broker flows.
 * Run:  node tests/verify-broker-auth.js
 *
 * Brokers differ in shape; the tests assert each shape works AND that the shared
 * invariants hold for all of them:
 *   - a REQUEST token is never cached as the session token
 *   - a failed login caches nothing and never reports success
 *   - the raw token is never returned to the caller
 *   - token TTL follows the broker's own expiry policy, not a hardcoded number
 */
const path = require('path');
const crypto = require('crypto');
const OTPAuth = require('otpauth');

const M = path.join(__dirname, '..', 'src', 'modules', 'broker');
const BrokerSessionService = require(path.join(M, 'BrokerSessionService'));
const { secondsUntilISTMidnight, secondsUntilNextISTHour, normalizeBase32Secret, generateTOTP } = BrokerSessionService;
const { listStrategies, getStrategy } = require(path.join(M, 'strategies'));

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };

const REQUEST_TOKEN = '697c39bf-9411-46b0-81c2-67448ee99c72'; // per MStock docs: a UUID
const TRADING_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.trading.token';
const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';

// Deliberately use the REAL generator (not a reimplementation) so the tests exercise
// normalizeBase32Secret's guarantees rather than a stub's looser behaviour.
const realTOTP = generateTOTP;

/** Fake MStock adapter — routes all SDK calls through the same fake HTTP dispatcher. */
function makeFakeAdapter(http) {
  return {
    id: 'mstock',
    async login(params) {
      try {
        const resp = await http.post('https://mstock.login/connect/login', params);
        const body = resp.data;
        if (body?.status !== true && body?.status !== 'true') {
          throw new Error(body?.message || 'MStock login failed');
        }
        return { jwtToken: body?.data?.jwtToken };
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        const e = new Error(msg);
        Object.assign(e, { response: err.response });
        throw e;
      }
    },
    async verifyTOTP(refreshToken, totp) {
      try {
        const resp = await http.post('https://mstock.login/session/verifytotp', { refreshToken, totp });
        const body = resp.data;
        if (body?.status !== true && body?.status !== 'true') {
          throw new Error(body?.message || 'MStock TOTP verification failed');
        }
        return { jwtToken: body?.data?.jwtToken };
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        const e = new Error(msg);
        Object.assign(e, { response: err.response, serverTimeUtc: new Date().toISOString() });
        throw e;
      }
    },
    async verifyOTP(refreshToken, otp) {
      try {
        const resp = await http.post('https://mstock.login/session/verifyotp', { refreshToken, otp });
        const body = resp.data;
        if (body?.status !== true && body?.status !== 'true') {
          throw new Error(body?.message || 'MStock OTP verification failed');
        }
        return { jwtToken: body?.data?.jwtToken };
      } catch (err) {
        const msg = err.response?.data?.message || err.message;
        const e = new Error(msg);
        Object.assign(e, { response: err.response });
        throw e;
      }
    },
    async logout() {},
  };
}

/** In-memory stand-ins for BrokerService + a routable fake HTTP client. */
function makeService({ creds, routes }) {
  const store = { session: {}, json: {} };
  const calls = [];

  const brokerService = {
    getDecryptedCredentials: async () => creds,
    getSessionToken: async (p) => store.session[p] || null,
    saveSessionToken: async (p, token, ttl) => { store.session[p] = token; store.ttl = ttl; },
    clearSessionToken: async (p) => { delete store.session[p]; return { cleared: true }; },
    saveAccessToken: async (p, token) => {}, // no-op in test: tests check session store, not DB
    setJson: async (k, v) => { store.json[k] = JSON.parse(JSON.stringify(v)); },
    getJson: async (k) => store.json[k] ?? null,
    delKey: async (k) => { delete store.json[k]; },
  };

  const dispatch = (method) => async (url, a, b) => {
    const body = method === 'post' ? a : undefined;
    const queryParams = b?.params || {};
    calls.push({ method, url, body, params: queryParams });
    const handler = Object.keys(routes).find((r) => url.includes(r));
    if (!handler) throw new Error(`no fake route for ${url}`);
    const res = routes[handler];
    if (typeof res === 'function') return res(body, b);
    if (res instanceof Error) throw res;
    return { data: res };
  };

  const http = { post: dispatch('post'), get: dispatch('get') };

  const svc = new BrokerSessionService({ brokerService });
  svc.deps = {
    http,
    generateTOTP: realTOTP,
    sha256: (s) => crypto.createHash('sha256').update(s).digest('hex'),
    now: undefined,
    adapter: makeFakeAdapter(http),
  };
  return { svc, store, calls };
}

const LOGIN_OK = { status: 'true', message: 'Please enter the OTP...', data: { jwtToken: REQUEST_TOKEN } };
const VERIFY_OK = { status: true, data: { ClientId: 'C123', ClientName: 'TEST', jwtToken: TRADING_TOKEN } };

(async () => {
  console.log('\nA. Strategy registry contract');
  {
    const list = listStrategies();
    ok('4 brokers registered', list.length === 4, String(list.length));
    const ms = list.find((s) => s.id === 'mstock');
    const kt = list.find((s) => s.id === 'kite');
    const ft = list.find((s) => s.id === 'flattrade');
    const ia = list.find((s) => s.id === 'indianapi');
    ok('mstock declares totp_secret optional + otp interactive', ms.optionalFields.includes('totp_secret') && ms.interactiveInputs.includes('otp'));
    ok('kite declares request_token interactive', kt.interactiveInputs.includes('request_token') && kt.interactive === true);
    ok('flattrade declares request_code interactive', ft.interactiveInputs.includes('request_code') && ft.interactive === true);
    ok('indianapi cannot execute', ia.capabilities.execution === false);
    ok('mstock declares NO resting stop (matches MStockOMS)', ms.capabilities.restingStop === false);
    ok('flattrade declares resting stop', ft.capabilities.restingStop === true);
    ok('unknown provider -> null', getStrategy('nope') === null);
  }

  console.log('\nB. MStock — unattended TOTP path');
  {
    const { svc, store, calls } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p', totp_secret: TOTP_SECRET },
      routes: { '/connect/login': LOGIN_OK, '/session/verifytotp': VERIFY_OK },
    });
    const r = await svc.testConnection('mstock');

    ok('connected', r.success === true, r.error);
    const login = calls.find((c) => c.url.includes('/connect/login'));
    const verify = calls.find((c) => c.url.includes('/session/verifytotp'));
    ok('login sent totp:"" and state:""', login.body.totp === '' && login.body.state === '');
    ok('verifytotp called with the REQUEST token', verify.body.refreshToken === REQUEST_TOKEN);
    ok('verifytotp sent a 6-digit code', /^\d{6}$/.test(verify.body.totp), verify.body.totp);
    ok('cached token is the TRADING token', store.session.mstock === TRADING_TOKEN);
    ok('request token NOT cached (the bug that shipped twice)', store.session.mstock !== REQUEST_TOKEN);
    ok('raw token not returned to caller', r.token === undefined && typeof r.token_length === 'number');
    ok('TTL is not the old fixed 21000s', store.ttl !== 21000, String(store.ttl));
  }

  console.log('\nC. MStock — interactive OTP path (no totp_secret)');
  {
    const { svc, store, calls } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p' },
      routes: {
        '/connect/login': LOGIN_OK,
        '/session/verifyotp': (body) => {
          if (body.otp === '123456') {
            return { data: { status: true, data: { jwtToken: TRADING_TOKEN } } };
          } else {
            return { data: { status: 'false', message: 'Entered OTP has been expired.' } };
          }
        },
      },
    });

    const begin = await svc.testConnection('mstock');
    ok('begin -> needs_input', begin.success === false && begin.status === 'needs_input');
    ok('inputType = otp', begin.inputType === 'otp');
    ok('pending is NOT leaked to the caller', begin.pending === undefined);
    ok('nothing cached yet', store.session.mstock === undefined);
    ok('verifytotp was NOT called', !calls.some((c) => c.url.includes('verifytotp')));
    ok('request token parked in redis', store.json['broker:pending:mstock']?.requestToken === REQUEST_TOKEN);

    const loginsSoFar = () => calls.filter((c) => c.url.includes('/connect/login')).length;
    const before = loginsSoFar();

    const bad = await svc.completeSession('mstock', { otp: '000000' });
    ok('wrong OTP -> failure', bad.success === false, bad.error);
    ok('wrong OTP caches nothing', store.session.mstock === undefined);
    ok('wrong OTP did NOT re-login (would send another OTP)', loginsSoFar() === before);
    ok('parked login survives a mistyped OTP', store.json['broker:pending:mstock']?.requestToken === REQUEST_TOKEN);
    ok('internal retryPending flag not leaked', bad.retryPending === undefined);

    // Retry with the correct code — still no second OTP was ever sent.
    const done = await svc.completeSession('mstock', { otp: '123456' });
    ok('correct OTP -> connected', done.success === true, done.error);
    ok('still only one login for the whole flow', loginsSoFar() === before);
    ok('trading token cached', store.session.mstock === TRADING_TOKEN);
    ok('pending cleared after success', store.json['broker:pending:mstock'] === undefined);
  }

  console.log('\nD. MStock — failure modes');
  {
    const { svc, store } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'bad', totp_secret: TOTP_SECRET },
      routes: { '/connect/login': { status: 'false', message: 'Invalid username or password.' } },
    });
    const r = await svc.testConnection('mstock');
    ok('bad password -> stage login', r.success === false && r.stage === 'login');
    ok('broker message surfaced', /Invalid username or password/.test(r.error), r.error);
    ok('nothing cached', store.session.mstock === undefined);
  }
  {
    // Broker echoes the request token back as the trading token -> must be rejected.
    const { svc, store } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p', totp_secret: TOTP_SECRET },
      routes: { '/connect/login': LOGIN_OK, '/session/verifytotp': { status: true, data: { jwtToken: REQUEST_TOKEN } } },
    });
    const r = await svc.testConnection('mstock');
    ok('echoed request token rejected', r.success === false);
    ok('nothing cached', store.session.mstock === undefined);
  }
  {
    const { svc } = makeService({ creds: { client_code: 'c', password: 'p' }, routes: {} });
    const r = await svc.testConnection('mstock');
    ok('missing api_key reported before any network call', r.success === false && r.missing.includes('api_key'));
  }

  console.log('\nE. Kite — browser redirect (request_token + checksum)');
  {
    const API_KEY = 'kapi', SECRET = 'ksecret', RT = 'reqtok123', AT = 'access-token-xyz';
    const expectedChecksum = crypto.createHash('sha256').update(`${API_KEY}${RT}${SECRET}`).digest('hex');
    let seenParams = null;

    const { svc, store } = makeService({
      creds: { api_key: API_KEY, api_secret: SECRET },
      routes: {
        '/session/token': (body, config) => { seenParams = config?.params || {}; return { data: { status: 'success', data: { access_token: AT, user_name: 'Zed' } } }; },
      },
    });

    const begin = await svc.testConnection('kite');
    ok('begin -> needs_input(request_token)', begin.status === 'needs_input' && begin.inputType === 'request_token');
    ok('login URL surfaced to the operator', /kite\.zerodha\.com\/connect\/login/.test(begin.error));
    ok('nothing cached', store.session.kite === undefined);

    const done = await svc.completeSession('kite', { request_token: RT });
    ok('request_token exchange -> connected', done.success === true, done.error);
    ok('checksum = SHA256(api_key + request_token + api_secret)', seenParams.checksum === expectedChecksum);
    ok('access_token cached (not the request_token)', store.session.kite === AT && store.session.kite !== RT);
    ok('raw token not returned', done.token === undefined);
  }
  {
    // Stored access_token path: validate and reuse, no browser step.
    const { svc, store } = makeService({
      creds: { api_key: 'kapi', access_token: 'stored-at' },
      routes: { '/user/profile': { status: 'success', data: { user_name: 'Zed' } } },
    });
    const r = await svc.testConnection('kite');
    ok('stored access_token validated -> connected', r.success === true, r.error);
    ok('token cached', store.session.kite === 'stored-at');
    ok('auth_type reported', r.auth_type === 'access_token');
  }
  {
    const { svc } = makeService({ creds: { api_key: 'kapi' }, routes: {} });
    const r = await svc.testConnection('kite');
    ok('neither access_token nor api_secret -> clear error', r.success === false && r.stage === 'credentials');
  }
  {
    const { svc } = makeService({ creds: { api_key: 'kapi', api_secret: 's' }, routes: {} });
    const r = await svc.completeSession('kite', { otp: '123456' });
    ok('kite rejects an `otp` it never asked for', r.success === false && /request_token/.test(r.error));
  }

  console.log('\nF. FlatTrade — browser redirect (request_code + SHA256 hash)');
  {
    const API_KEY = 'ftkey', SECRET = 'ftsecret', RC = 'reqcode123', JKEY = 'jkey-abc-999';
    const expectedHash = crypto.createHash('sha256').update(`${API_KEY}${RC}${SECRET}`).digest('hex');
    let seenBody = null;

    const { svc, store } = makeService({
      creds: { api_key: API_KEY, api_secret: SECRET, client_code: 'FT01' },
      routes: {
        '/trade/apitoken': (body) => { seenBody = body; return { data: { status: 'Ok', token: JKEY, client: 'FT01', emsg: '' } }; },
      },
    });

    const begin = await svc.testConnection('flattrade');
    ok('begin -> needs_input(request_code)', begin.status === 'needs_input' && begin.inputType === 'request_code');
    ok('auth portal URL surfaced', /auth\.flattrade\.in\/\?app_key=ftkey/.test(begin.error));
    ok('nothing cached', store.session.flattrade === undefined);

    const done = await svc.completeSession('flattrade', { request_code: RC });
    ok('request_code exchange -> connected', done.success === true, done.error);
    ok('doc quirk: the `api_secret` FIELD carries SHA256(api_key+request_code+api_secret)', seenBody.api_secret === expectedHash);
    ok('raw secret never sent', seenBody.api_secret !== SECRET);
    ok('jKey cached (not the api_key, not the request_code)', store.session.flattrade === JKEY);
    ok('api_key is NOT the session token', store.session.flattrade !== API_KEY);
    ok('raw token not returned', done.token === undefined);
  }
  {
    // Stored jKey path: probe UserDetails, no browser step.
    const { svc, store } = makeService({
      creds: { api_key: 'ftkey', client_code: 'FT01', access_token: 'stored-jkey' },
      routes: { '/UserDetails': { stat: 'Ok', uname: 'Trader' } },
    });
    const r = await svc.testConnection('flattrade');
    ok('stored jKey validated -> connected', r.success === true, r.error);
    ok('jKey cached', store.session.flattrade === 'stored-jkey');
    ok('user surfaced', r.user === 'Trader');
  }
  {
    const { svc, store } = makeService({
      creds: { api_key: 'ftkey', client_code: 'FT01', access_token: 'expired' },
      routes: { '/UserDetails': { stat: 'Not_Ok', emsg: 'Invalid Session Key' } },
    });
    const r = await svc.testConnection('flattrade');
    ok('expired jKey -> failure', r.success === false);
    ok('emsg surfaced', /Invalid Session Key/.test(r.error), r.error);
    ok('nothing cached', store.session.flattrade === undefined);
  }
  {
    const { svc } = makeService({ creds: { api_key: 'ftkey' }, routes: {} });
    const r = await svc.testConnection('flattrade');
    ok('no api_secret and no jKey -> clear error', r.success === false && r.stage === 'credentials');
  }

  console.log('\nF2. FlatTrade regressions — GAP-K1 (base URL) + GAP-K2 (session TTL)');
  {
    // K1: the strategy hardcoded the /PiConnectTP base, which shared/constants.js explicitly
    // flags as WRONG (/PiConnectAPI). Every jKey validation silently hit a dead path.
    const { svc, calls } = makeService({
      creds: { api_key: 'ftkey', client_code: 'FT01', access_token: 'stored-jkey' },
      routes: { '/UserDetails': { stat: 'Ok', uname: 'Trader' } },
    });
    await svc.testConnection('flattrade');
    const ud = calls.find((c) => c.url.includes('/UserDetails'));
    ok('K1: UserDetails uses the /PiConnectAPI base', !!ud && ud.url.includes('/PiConnectAPI/UserDetails'), ud && ud.url);
    ok('K1: the wrong /PiConnectTP base is gone', !calls.some((c) => c.url.includes('/PiConnectTP')));
  }
  {
    // K2: FlatTrade cannot authenticate unattended, so its session must outlive the trading
    // day. The TTL used to run only to the next CLOCK HOUR, silently forcing the operator to
    // redo the browser login every hour. It must now run to the broker's 06:00 IST token reset.
    const ft = getStrategy('flattrade');
    const IST = 5.5 * 3600000;
    const istWallClock = (h, m) => {
      const ist = new Date(Date.now() + IST);
      return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), h, m, 0) - IST);
    };
    const hrs = (s) => `${(s / 3600).toFixed(1)}h`;
    const at0930 = ft.ttlSeconds(istWallClock(9, 30));
    const at1400 = ft.ttlSeconds(istWallClock(14, 0));
    const at0300 = ft.ttlSeconds(istWallClock(3, 0));
    ok('K2: 09:30 IST session survives the trading day (>15h)', at0930 > 15 * 3600, hrs(at0930));
    ok('K2: 14:00 IST session survives the trading day (>12h)', at1400 > 12 * 3600, hrs(at1400));
    ok('K2: 03:00 IST expires at the 06:00 broker reset (~3h)', at0300 > 2 * 3600 && at0300 < 4 * 3600, hrs(at0300));
    ok('K2: TTL is no longer the next clock hour', at0930 > 3600 && at1400 > 3600);
  }

  console.log('\nF3. Session TTL never outlives the token itself (GAP-M1)');
  {
    // MStock issues JWTs that live 300s, but the strategy policy cached them until IST midnight
    // (~12h). For almost their entire cached life we served a token the broker had already
    // killed — every call came back 401, and MStock "could not fetch data" at all.
    const jwt = (expSecondsFromNow) => {
      const claims = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })).toString('base64');
      return `eyJhbGciOiJIUzI1NiJ9.${claims}.sig`;
    };

    const short = jwt(300); // what MStock actually issues
    const { svc, store } = makeService({ creds: { api_key: 'k' }, routes: {} });

    await svc.saveToken('mstock', short, 43200); // policy asks for 12h
    ok('M1: TTL clamped to the JWT exp, not the 12h policy', store.ttl <= 300 && store.ttl > 200, `ttl=${store.ttl}`);

    await svc.saveToken('mstock', jwt(-60), 43200); // already-dead token
    ok('M1: an already-expired token is not cached as valid', store.ttl <= 1, `ttl=${store.ttl}`);

    await svc.saveToken('flattrade', 'opaque-jkey-not-a-jwt', 3600);
    ok('M1: opaque (non-JWT) tokens keep the policy TTL', store.ttl === 3600, `ttl=${store.ttl}`);
  }

  console.log('\nG. IndianAPI — no auth, nothing cached');
  {
    const { svc, store } = makeService({ creds: {}, routes: {} });
    const r = await svc.testConnection('indianapi');
    ok('connected without credentials', r.success === true, r.error);
    ok('no token cached (token is null)', store.session.indianapi === undefined);
    ok('auth_type = none', r.auth_type === 'none');
  }

  console.log('\nH. getOrRefreshToken caches; invalidate forces re-auth');
  {
    const { svc, calls } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p', totp_secret: TOTP_SECRET },
      routes: { '/connect/login': LOGIN_OK, '/session/verifytotp': VERIFY_OK },
    });
    const first = await svc.getOrRefreshToken('mstock');
    ok('first call authenticates', first === TRADING_TOKEN);
    const logins = () => calls.filter((c) => c.url.includes('/connect/login')).length;
    ok('one login', logins() === 1);

    const second = await svc.getOrRefreshToken('mstock');
    ok('second call reuses cache', second === TRADING_TOKEN);
    ok('did NOT re-authenticate (`cached.expiresAt` bug)', logins() === 1, `logins=${logins()}`);

    await svc.invalidateSession('mstock');
    await svc.getOrRefreshToken('mstock');
    ok('re-authenticates after invalidation', logins() === 2);
  }

  console.log('\nH2. Background refresh must NEVER trigger an OTP (no totp_secret => no login)');
  {
    const { svc, calls } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p' }, // no totp_secret => interactive
      routes: { '/connect/login': LOGIN_OK },
    });
    const t = await svc.getOrRefreshToken('mstock');
    ok('returns null instead of logging in', t === null);
    ok('ZERO logins => zero OTPs sent to the operator', calls.filter((c) => c.url.includes('/connect/login')).length === 0);

    // Kite: no access_token => request_token needed => must not auto-authenticate either.
    const k = makeService({ creds: { api_key: 'kapi', api_secret: 's' }, routes: {} });
    ok('kite without access_token does not auto-authenticate', (await k.svc.getOrRefreshToken('kite')) === null);
    ok('kite made no network calls', k.calls.length === 0);
  }

  console.log('\nI. TTL policies differ per broker');
  {
    // 2026-07-09 20:00 IST == 14:30 UTC
    const at2000IST = new Date(Date.UTC(2026, 6, 9, 14, 30, 0));
    ok('mstock: 20:00 IST -> ~4h (next IST midnight)', Math.abs(secondsUntilISTMidnight(at2000IST) - (4 * 3600 - 120)) < 2);
    ok('kite: 20:00 IST -> ~10h (next 06:00 IST)', Math.abs(secondsUntilNextISTHour(6, at2000IST) - (10 * 3600 - 120)) < 2);

    // 03:00 IST -> next 06:00 is the SAME day (3h), midnight is 21h away
    const at0300IST = new Date(Date.UTC(2026, 6, 9, 21, 30, 0));
    ok('kite: 03:00 IST -> ~3h (same-day 06:00)', Math.abs(secondsUntilNextISTHour(6, at0300IST) - (3 * 3600 - 120)) < 2);
    ok('mstock: 03:00 IST -> ~21h', Math.abs(secondsUntilISTMidnight(at0300IST) - (21 * 3600 - 120)) < 2);
    ok('never negative near the boundary', secondsUntilISTMidnight(new Date(Date.UTC(2026, 6, 9, 18, 29, 30))) >= 60);
  }

  console.log('\nJ. TOTP secret normalisation (a malformed secret must NOT silently produce a wrong code)');
  {
    const canonical = 'JBSWY3DPEHPK3PXP';
    ok('plain base32 accepted', normalizeBase32Secret(canonical) === canonical);
    ok('lowercase normalised', normalizeBase32Secret('jbswy3dpehpk3pxp') === canonical);
    ok('spaces stripped', normalizeBase32Secret('JBSW Y3DP EHPK 3PXP') === canonical);
    ok('hyphens stripped', normalizeBase32Secret('JBSW-Y3DP-EHPK-3PXP') === canonical);
    ok('= padding stripped', normalizeBase32Secret('JBSWY3DPEHPK3PXP====') === canonical);
    ok('otpauth:// URI secret extracted', normalizeBase32Secret(`otpauth://totp/mStock:me?secret=${canonical}&issuer=mStock`) === canonical);

    const throwsWith = (input, re) => {
      try { normalizeBase32Secret(input); return false; } catch (e) { return re.test(e.message); }
    };
    ok('hex secret THROWS (used to silently yield a wrong code)', throwsWith('a1b2c3d4e5f6', /not valid Base32/));
    ok('0/1 characters THROW', throwsWith('JBSWY3DPEHPK3PX0', /not valid Base32/));
    ok('empty THROWS', throwsWith('   ', /empty/));
    ok('error names A-Z and 2-7', throwsWith('####', /A-Z, 2-7/));

    // The whole point: bad secrets must never reach the broker as a plausible code.
    let generated = null;
    try { generated = generateTOTP('a1b2c3d4e5f6'); } catch (_) { /* expected */ }
    ok('generateTOTP refuses a hex secret instead of emitting 6 digits', generated === null);
    ok('generateTOTP works on a good secret', /^\d{6}$/.test(generateTOTP(canonical)));
  }

  console.log('\nK. Broker rejects the code -> actionable diagnosis, not a parroted message');
  {
    // Reproduces the real response: HTTP 400 {status:'error', message:'Please enter correct TOTP'}
    const rejection = Object.assign(new Error('Request failed with status code 400'), {
      response: { status: 400, data: { status: 'error', message: 'Please enter correct TOTP', error_type: 'MA400' } },
    });
    const { svc, store } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p', totp_secret: TOTP_SECRET },
      routes: { '/connect/login': LOGIN_OK, '/session/verifytotp': rejection },
    });
    const r = await svc.testConnection('mstock');

    ok('fails at verify_totp', r.success === false && r.stage === 'verify_totp', r.stage);
    ok('broker message preserved', /Please enter correct TOTP/.test(r.error));
    ok('serverTimeUtc returned (to diagnose clock skew)', typeof r.serverTimeUtc === 'string');
    ok('lists likely causes', Array.isArray(r.likelyCauses) && r.likelyCauses.length === 3);
    ok('mentions TOTP may not be enabled on the account', r.likelyCauses.some((c) => /Enable TOTP/i.test(c)));
    ok('mentions clock skew', r.likelyCauses.some((c) => /clock skew/i.test(c)));
    ok('nothing cached on failure', store.session.mstock === undefined);
  }
  {
    // A malformed secret must be reported as such — never as "wrong TOTP".
    const { svc, calls } = makeService({
      creds: { api_key: 'k', client_code: 'c', password: 'p', totp_secret: 'not-base32-!!' },
      routes: { '/connect/login': LOGIN_OK },
    });
    const r = await svc.testConnection('mstock');
    ok('stage = totp_secret (not verify_totp)', r.success === false && r.stage === 'totp_secret', r.stage);
    ok('error explains the Base32 requirement', /not valid Base32/.test(r.error));
    ok('never called verifytotp with a bogus code', !calls.some((c) => c.url.includes('verifytotp')));
  }

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
