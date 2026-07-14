/**
 * L7 API auth — GAP-J1 (auth bypass) + GAP-J4 (wildcard CORS).
 * Run:  node --import tsx tests/verify-api-auth.js
 *
 * The bug: the global hook authenticated ONLY when an x-api-key header happened to be
 * present, so a request that simply omitted it was served unauthenticated — including the
 * route returning DECRYPTED broker credentials and the kill switch. These assertions exist
 * so that pattern can never come back.
 */
const fs = require('fs');
const path = require('path');

// Must be set before AuthMiddleware is required — it reads the key at module scope.
const SERVICE_KEY = 'test-internal-key-abc123';
process.env.INTERNAL_API_KEY = SERVICE_KEY;

const SHARED = require(path.join(__dirname, '..', '..', '..', 'shared', 'constants'));
const SRC = path.join(__dirname, '..', 'src');
const authPlugin = require(path.join(SRC, 'middleware', 'AuthMiddleware'));

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

/**
 * Source assertions must look at CODE, not comments. The fixes deliberately quote the old
 * vulnerable lines ("this used to be `if (req.headers['x-api-key'])`...") so the next reader
 * understands what was wrong — and those comments otherwise match the very patterns we are
 * asserting are gone. Strip comment lines first.
 */
const code = (...p) => read(...p)
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*\/|\/\*|\*)/.test(l))
  .join('\n');

/** Capture the `authenticate` function the plugin decorates onto fastify. */
async function makeAuthenticate({ keyRecord = null } = {}) {
  let authenticate = null;
  const fastify = {
    decorate: (name, fn) => { if (name === 'authenticate') authenticate = fn; },
    container: { cradle: {
      prisma: { api_keys: { findUnique: async () => keyRecord } },
      redis: { isOpen: false, get: async () => null, set: async () => {} },
    } },
  };
  // fastify-plugin wraps the fn; unwrap by calling the underlying plugin directly.
  const plugin = authPlugin.default || authPlugin;
  await plugin(fastify, {});
  return authenticate;
}

function makeReqReply(headers = {}) {
  const reply = { statusCode: null, body: null,
    code(c) { this.statusCode = c; return this; },
    send(b) { this.body = b; return this; } };
  const req = { headers, log: { error: () => {} }, vendor: undefined };
  return { req, reply };
}

(async () => {
  console.log('\nA. J1 — default deny (a missing key is a rejection, not a skip)');
  {
    const authenticate = await makeAuthenticate();

    const { req, reply } = makeReqReply({}); // no x-api-key at all
    await authenticate(req, reply);
    ok('J1: no api-key header -> 401', reply.statusCode === 401, `got ${reply.statusCode}`);
    ok('J1: request is NOT authenticated', req.vendor === undefined);
  }
  {
    // The exact route that leaked plaintext broker api_key / password / totp_secret.
    const authenticate = await makeAuthenticate();
    const { req, reply } = makeReqReply({});
    await authenticate(req, reply);
    ok('J1: credentials/decrypted path cannot be reached unauthenticated', reply.statusCode === 401);
  }
  {
    const authenticate = await makeAuthenticate();
    const { req, reply } = makeReqReply({ [SHARED.API_KEY_HEADER]: SERVICE_KEY });
    await authenticate(req, reply);
    ok('internal service key -> authenticated', reply.statusCode === null && req.vendor?.role === 'internal');
  }
  {
    // Unknown key, and the DB has no such row.
    const authenticate = await makeAuthenticate({ keyRecord: null });
    const { req, reply } = makeReqReply({ [SHARED.API_KEY_HEADER]: 'not-the-key' });
    await authenticate(req, reply);
    ok('wrong key -> 403 (not silently allowed)', reply.statusCode === 403, `got ${reply.statusCode}`);
  }
  {
    const authenticate = await makeAuthenticate({ keyRecord: { id: 7, vendor_name: 'v', user_id: 1, rate_limit: 10, is_active: false } });
    const { req, reply } = makeReqReply({ [SHARED.API_KEY_HEADER]: 'inactive-key' });
    await authenticate(req, reply);
    ok('inactive DB key -> 403', reply.statusCode === 403);
  }

  console.log('\nB. Public-route allow-list is narrow');
  {
    const pub = SHARED.PUBLIC_API_ROUTES;
    ok('/health is public', pub.includes('/health'));
    ok('/metrics is public', pub.includes('/metrics'));
    ok('J1: /api/v1 is NOT public', !pub.some((p) => p.startsWith('/api/v1')));
    ok('J1: /api/market is NOT public', !pub.some((p) => p.startsWith('/api/market')));
  }

  console.log('\nC. The vulnerable patterns are gone from source');
  {
    const index = code(SRC, 'index.ts');
    // The bug, verbatim: auth ran only when the header existed.
    ok('J1: conditional-on-header auth gate is gone',
      !/if\s*\(\s*req\.headers\[['"]x-api-key['"]\]\s*\)/.test(index));
    ok('J1: hook authenticates every non-public route',
      /isPublicRoute\(req\.url\)/.test(index) && /await fastify\.authenticate\(req, reply\)/.test(index));
    ok('J1: refuses to boot without INTERNAL_API_KEY',
      /INTERNAL_API_KEY/.test(index) && /refusing to start/.test(read(SRC, 'index.ts')));

    ok('J4: REST CORS is not `origin: true`', !/origin:\s*true/.test(index), 'origin: true reflects any site');
    const ws = code(SRC, 'plugins', 'websocket.ts');
    ok('J4: socket CORS is not `origin: "*"`', !/origin:\s*['"]\*['"]/.test(ws));
  }

  console.log('\nD. Callers present the key — and only to our own gateway');
  {
    const portal = path.join(__dirname, '..', '..', '..', 'layer-8-presentation-notification', 'stock-analysis-portal', 'src');
    const mw = read(portal, 'middleware.ts');
    // The middleware hardcodes the header (edge runtime can't require CommonJS) — so the
    // literal MUST match the shared constant, or the dashboard 401s against L7.
    ok('dashboard middleware header === shared API_KEY_HEADER',
      new RegExp(`API_KEY_HEADER\\s*=\\s*['"]${SHARED.API_KEY_HEADER}['"]`).test(mw));
    ok('dashboard key is server-side only (never NEXT_PUBLIC_*)',
      /process\.env\.INTERNAL_API_KEY/.test(mw) && !/NEXT_PUBLIC_INTERNAL/.test(mw));
    ok('dashboard strips any client-supplied key before injecting',
      /headers\.delete\(API_KEY_HEADER\)/.test(mw));

    const l1 = read(__dirname, '..', '..', '..', 'layer-1-ingestion', 'src', 'utils', 'axios-interceptor.ts');
    ok('L1 sends the key ONLY to the backend (not to broker APIs)',
      /isBackendUrl\(config\.url\)/.test(l1), 'a blanket axios default would leak the key to MStock/FlatTrade');

    const l10 = read(__dirname, '..', '..', '..', 'layer-10-execution', 'src', 'credential-provider.ts');
    ok('L10 sends the key on both L7 calls',
      (l10.match(/internalAuthHeaders\(\)/g) || []).length >= 2);
  }

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
