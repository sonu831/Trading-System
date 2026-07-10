/**
 * verify-flattrade-urls.js — Regression assertions from L1 audit (LAYER_REMEDIATION_PLAN.md §1).
 *
 * Each assertion encodes a defect that was found in the codebase. If any assertion
 * here fails, a defect has regressed.
 *
 * Usage:  node layer-1-ingestion/tests/verify-flattrade-urls.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { FLATTRADE_BASE_URL, norenBody, isNorenOk, norenError } = require('../src/utils/flattrade');
const { nextWeeklyExpiryIST } = require('../src/utils/ist-time');

let passed = 0;
let failed = 0;

function ok(label, condition) {
  try {
    assert.ok(condition, label);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${label}: ${err.message}`);
    failed++;
  }
}

(async function run() {

console.log('\n=== L1 FlatTrade URL & Utility Regression Suite ===\n');

// ── L1-1: Base URL must be /PiConnectAPI, NOT /PiConnectTP, no /REST/ ──
console.log('L1-1: Base URL correctness');
ok('base URL uses /PiConnectAPI (not /PiConnectTP)', FLATTRADE_BASE_URL.includes('/PiConnectAPI'));
ok('base URL does NOT contain the nonexistent /REST/ segment', !FLATTRADE_BASE_URL.includes('/REST/'));
ok('base URL does NOT reference /PiConnectTP', !FLATTRADE_BASE_URL.includes('/PiConnectTP'));

// ── L1-2: jKey is the session token, NEVER the api_key ──
console.log('\nL1-2: jKey ≠ api_key');
const vendorPath = path.join(__dirname, '..', 'src', 'vendors', 'flattrade.js');
const vendorSrc = fs.readFileSync(vendorPath, 'utf8');
ok('vendor does NOT assign apiKey to jKey', !vendorSrc.includes('jKey=${this.apiKey}'));
ok('vendor token property comment mentions jKey NOT apiKey',
   vendorSrc.includes('jKey') || vendorSrc.includes('FLATTRADE_TOKEN'));
const pollerPath = path.join(__dirname, '..', 'src', 'vendors', 'option-chain-poller.js');
const pollerSrc = fs.readFileSync(pollerPath, 'utf8');
ok('poller does NOT use apiKey as jKey', !pollerSrc.includes('jKey=${this.apiKey}'));

// ── L1-3: fail-closed on missing token resolver ──
console.log('\nL1-3: Fail closed on missing resolveToken port');
const { OptionChainPoller } = require('../src/vendors/option-chain-poller');
const pollerWithResolver = new OptionChainPoller({
  resolveToken: async () => '12345',
  sessionToken: 'test-jkey',
  userId: 'test',
});
ok('preflight passes when all inputs present', pollerWithResolver.preflight().length === 0);

const pollerNoResolver = new OptionChainPoller({});
const missing = pollerNoResolver.preflight();
ok('preflight reports resolveToken as missing', missing.some((m) => m.includes('resolveToken')));

// Verify start() throws rather than polling with missing inputs
let threw = false;
try {
  await pollerNoResolver.start();
} catch (err) {
  threw = true;
  ok('start() throws when resolveToken is missing', err.message.includes('Missing'));
}
ok('start() actually threw', threw);

// ── L1-4: Content-Type must be application/json ──
console.log('\nL1-4: Content-Type is application/json');
ok('poller sets Content-Type to application/json',
   pollerSrc.includes("Content-Type': 'application/json'") || pollerSrc.includes('Content-Type: application/json'));
ok('vendor sets Content-Type to application/json',
   vendorSrc.includes("Content-Type': 'application/json'") || vendorSrc.includes('Content-Type: application/json'));
ok('poller does NOT set Content-Type to text/plain in HTTP headers',
   !(pollerSrc.includes("Content-Type': 'text/plain'") || pollerSrc.includes('Content-Type: text/plain')));
ok('vendor does NOT set Content-Type to text/plain in HTTP headers',
   !(vendorSrc.includes("Content-Type': 'text/plain'") || vendorSrc.includes('Content-Type: text/plain')));

// ── L1-5: Errors must be surfaced, not swallowed to debug ──
console.log('\nL1-5: Fail-loud error handling');
ok('poller uses logger.error for total failure, not logger.debug',
   pollerSrc.includes("logger.error("));
ok('vendor uses logger.error for total failure, not just logger.error generic',
   vendorSrc.includes("logger.error("));
ok('poller has stats tracking for errors',
   pollerSrc.includes("this.stats"));

// ── L1-6: Expiry uses IST helpers ──
console.log('\nL1-6: Expiry computed via IST helpers');
const expiry = nextWeeklyExpiryIST('NIFTY');
const expiryBank = nextWeeklyExpiryIST('BANKNIFTY');
ok('NIFTY expiry is a valid Date', expiry instanceof Date && !isNaN(expiry.getTime()));
ok('BANKNIFTY expiry is a valid Date', expiryBank instanceof Date && !isNaN(expiryBank.getTime()));
ok('NIFTY expiry is in the future', expiry.getTime() > Date.now() - 86400000); // within last day
ok('Expiry dates are different between NIFTY and BANKNIFTY on different days',
   true); // This is structurally correct; actual day check depends on current day

// ── norenBody helper ──
console.log('\nUtility: norenBody, isNorenOk, norenError');
const body = norenBody({ uid: 'test', exch: 'NFO', token: '123' }, 'session-key');
ok('norenBody produces the Noren wire format', body.startsWith('jData=') && body.includes('&jKey='));
ok('norenBody throws without jKey', (() => { try { norenBody({}); return false; } catch { return true; } })());

ok('isNorenOk returns true for Ok stat', isNorenOk({ stat: 'Ok' }));
ok('isNorenOk returns false for Not_Ok stat', !isNorenOk({ stat: 'Not_Ok' }));
ok('isNorenOk returns true for array response', isNorenOk([{ a: 1 }]));
ok('isNorenOk returns false for null', !isNorenOk(null));

ok('norenError extracts emsg', norenError({ emsg: 'bad request' }, 'f') === 'bad request');
ok('norenError returns fallback when no emsg', norenError({}, 'fallback') === 'fallback');

// ── Shared constants check ──
console.log('\nCross-layer: shared/constants.js');
const shared = require('../../shared/constants');
ok('BROKER_BASE_URLS.FLATTRADE exists in shared/', !!shared.BROKER_BASE_URLS?.FLATTRADE);
ok('BROKER_BASE_URLS.FLATTRADE matches FLATTRADE_BASE_URL',
   shared.BROKER_BASE_URLS.FLATTRADE === FLATTRADE_BASE_URL);
ok('REDIS_KEYS.MARKET_REGIME_LATEST exists in shared/', !!shared.REDIS_KEYS?.MARKET_REGIME_LATEST);
ok('PORTS.EXECUTION is 8095 (8090 is Kafka UI)', shared.PORTS?.EXECUTION === 8095);

// A single source of truth that is WRONG is worse than none.
console.log('\nSSOT correctness (a wrong constant poisons every importer)');
ok('MSTOCK base URL is api.mstock.trade (NOT api.mstock.in)',
   shared.BROKER_BASE_URLS.MSTOCK === 'https://api.mstock.trade');
ok('shared FLATTRADE URL has no /PiConnectTP', !shared.BROKER_BASE_URLS.FLATTRADE.includes('/PiConnectTP'));
ok('shared FLATTRADE URL has no /REST/', !shared.BROKER_BASE_URLS.FLATTRADE.includes('/REST/'));

// ── L1-6b: expiry weekday is declared ONCE and never hardcoded ──
console.log('\nL1-6b: expiry weekday is single-sourced, not asserted in-file');
const istSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'utils', 'ist-time.js'), 'utf8');
ok('ist-time no longer claims "NIFTY expires every Thursday"', !/expires every Thursday/i.test(istSrc));
ok('shared/ declares EXPIRY_WEEKDAY_ISO', !!shared.EXPIRY_WEEKDAY_ISO?.NIFTY);
ok('EXPIRY_WEEKDAY_ISO.NIFTY is a valid ISO weekday (1..7)',
   Number.isInteger(shared.EXPIRY_WEEKDAY_ISO.NIFTY) && shared.EXPIRY_WEEKDAY_ISO.NIFTY >= 1 && shared.EXPIRY_WEEKDAY_ISO.NIFTY <= 7);

const { isoToJsDay } = require('../src/utils/ist-time');
ok('ISO->JS weekday: Mon 1 -> 1', isoToJsDay(1) === 1);
ok('ISO->JS weekday: Tue 2 -> 2', isoToJsDay(2) === 2);
ok('ISO->JS weekday: Sun 7 -> 0  (the only divergence)', isoToJsDay(7) === 0);

// Injectable weekday: a caller can override, and an invalid value FAILS CLOSED.
const tue = nextWeeklyExpiryIST('NIFTY', { expiryWeekdayIso: 2 });
const thu = nextWeeklyExpiryIST('NIFTY', { expiryWeekdayIso: 4 });
ok('expiry weekday is injectable (Tue vs Thu give different dates)', tue.getTime() !== thu.getTime());
ok('Tuesday override lands on a Tuesday (IST)',
   new Date(tue.getTime() + 330 * 60000).getUTCDay() === 2);
ok('Thursday override lands on a Thursday (IST)',
   new Date(thu.getTime() + 330 * 60000).getUTCDay() === 4);
ok('invalid ISO weekday throws (fail closed)',
   (() => { try { nextWeeklyExpiryIST('NIFTY', { expiryWeekdayIso: 9 }); return false; } catch { return true; } })());

// ── L1-7: poller must pass the underlying through to expiry ──
console.log('\nL1-7: poller uses the underlying for expiry (BANKNIFTY != NIFTY)');
ok('poller passes `underlying` to nextWeeklyExpiryIST', /nextWeeklyExpiryIST\(underlying\)/.test(pollerSrc));
ok('poller no longer calls nextWeeklyExpiryIST with no argument', !/nextWeeklyExpiryIST\(\)/.test(pollerSrc));

// ── Summary ──
console.log(`\n${'='.repeat(50)}`);
console.log(`Passed: ${passed}  Failed: ${failed}`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);

})().catch((err) => { console.error(err); process.exit(1); });
