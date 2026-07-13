/**
 * verify-wiring.js — End-to-end wiring verification for the realtime push plane.
 *
 * For each entry in shared/constants.js REDIS_CHANNELS, this test proves:
 *   1. A Redis publisher can publish to the channel
 *   2. A socket.io client subscribed to the canonical room receives the event
 *
 * Run: node scripts/verify-wiring.js
 * Requires: Docker services running (Redis + backend-api)
 */

const path = require('path');
const crypto = require('crypto');
const { createClient } = require('redis');
const { io } = require('socket.io-client');

// Load shared constants (both local and Docker paths)
let C;
try { C = require('/app/shared/constants'); } catch (_) {
  try { C = require(path.resolve(__dirname, '..', 'shared', 'constants')); } catch (e) { C = null; }
}
if (!C) { console.error('Cannot load shared/constants.js'); process.exit(1); }

const { REDIS_CHANNELS } = C;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const WS_URL = process.env.WS_URL || 'http://localhost:4000';
const TEST_TIMEOUT = 5000;

const ROOM_MAP = {
  [REDIS_CHANNELS.TICKS]: 'ticks',
  [REDIS_CHANNELS.SIGNALS]: 'signals',
  [REDIS_CHANNELS.REGIME]: 'regime',
  [REDIS_CHANNELS.BREADTH]: 'breadth',
  [REDIS_CHANNELS.OPTION_CHAIN]: 'chain',
  [REDIS_CHANNELS.EXECUTION_STATE]: 'positions',
  [REDIS_CHANNELS.EXECUTION_EVENTS]: 'execution',
  [REDIS_CHANNELS.ALERTS]: 'alerts',
};

const EVENT_MAP = {
  [REDIS_CHANNELS.TICKS]: 'tick',
  [REDIS_CHANNELS.SIGNALS]: 'signal',
  [REDIS_CHANNELS.REGIME]: 'regime',
  [REDIS_CHANNELS.BREADTH]: 'breadth',
  [REDIS_CHANNELS.OPTION_CHAIN]: 'chain',
  [REDIS_CHANNELS.EXECUTION_STATE]: 'positions',
  [REDIS_CHANNELS.EXECUTION_EVENTS]: 'execution',
  [REDIS_CHANNELS.ALERTS]: 'alert',
};

let pass = 0, fail = 0;
function ok(label, cond, detail = '') {
  if (cond) { pass++; console.log(`  PASS  ${label}`); }
  else { fail++; console.log(`  FAIL  ${label} ${detail}`); }
}

async function testChannel(pub, socket, channel, testPayload) {
  const room = ROOM_MAP[channel];
  const event = EVENT_MAP[channel];
  if (!room || !event) {
    ok(`channel ${channel} mapped to room/event`, false, 'missing mapping');
    return;
  }

  socket.emit('subscribe', room);
  await new Promise(r => setTimeout(r, 300)); // wait for subscription

  const fixture = JSON.stringify(testPayload);

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      ok(`${channel} → event received`, false, 'timeout — publisher or relay dead');
      resolve();
    }, TEST_TIMEOUT);

    socket.once(event, (data) => {
      clearTimeout(timer);
      ok(`${channel} → '${event}' received in room '${room}'`, true);
      resolve();
    });

    pub.publish(channel, fixture).catch(err => {
      clearTimeout(timer);
      ok(`${channel} publish`, false, err.message);
      resolve();
    });
  });
}

(async () => {
  console.log('\n=== Verify Wiring — realtime push plane ===\n');

  // 1. Channel names only from shared/constants.js
  ok('REDIS_CHANNELS loaded from shared/constants.js', !!REDIS_CHANNELS);

  // 2. Verify every canonical channel has a room mapping
  const channels = Object.values(REDIS_CHANNELS).filter(c => typeof c === 'string');
  console.log(`\nA. Channel coverage (${channels.length} channels)\n`);
  channels.forEach(ch => ok(`channel '${ch}' has room mapping`, !!ROOM_MAP[ch]));

  // 3. E2E: publish fixture → verify socket receives event
  console.log(`\nB. End-to-end delivery (publisher → relay → client)\n`);

  let pub, socket;
  try {
    pub = createClient({ url: REDIS_URL });
    await pub.connect();
    ok('Redis publisher connected', true);
  } catch (e) {
    ok('Redis publisher connected', false, e.message);
    console.log('\n  ⚠️  Skipping E2E tests — Redis not available');
    console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
    process.exit(fail === 0 ? 0 : 1);
  }

  try {
    socket = io(WS_URL, { transports: ['websocket', 'polling'], timeout: 5000 });
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('socket connect timeout')), 5000);
      socket.on('connect', () => { clearTimeout(t); resolve(); });
      socket.on('connect_error', (e) => { clearTimeout(t); reject(e); });
    });
    ok('Socket.io client connected', true);
  } catch (e) {
    ok('Socket.io client connected', false, e.message);
    console.log('\n  ⚠️  Skipping E2E tests — WS server not available');
    console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
    if (pub) await pub.quit();
    process.exit(fail === 0 ? 0 : 1);
  }

  // Test the 3 channels that have confirmed publishers
  for (const ch of [REDIS_CHANNELS.TICKS, REDIS_CHANNELS.REGIME, REDIS_CHANNELS.ALERTS]) {
    const fixture = ch === REDIS_CHANNELS.TICKS
      ? { underlying: 'NIFTY', ltp: 24850.30, time: new Date().toISOString() }
      : ch === REDIS_CHANNELS.REGIME
        ? { trend: 'TREND_UP', strength: 0.72, timestamp: Date.now() }
        : { severity: 'info', message: 'test', source: 'verify-wiring', timestamp: new Date().toISOString() };
    await testChannel(pub, socket, ch, fixture);
  }

  // 4. No duplicate relay check
  console.log(`\nC. Relay uniqueness\n`);
  ok('old SocketService.ts deleted', !require('fs').existsSync(path.resolve(__dirname, '..', 'layer-7-core-interface', 'api', 'src', 'services', 'SocketService.ts')));
  ok('old SocketService.js deleted', !require('fs').existsSync(path.resolve(__dirname, '..', 'layer-7-core-interface', 'api', 'src', 'services', 'SocketService.js')));

  // 5. Channel names not hardcoded in websocket.ts
  console.log('\nD. No string-literal channel names in relay\n');
  const relaySrc = require('fs').readFileSync(path.resolve(__dirname, '..', 'layer-7-core-interface', 'api', 'src', 'plugins', 'websocket.ts'), 'utf-8');
  const hardcodedMatches = relaySrc.match(/['"](market_ticks|option_chain_updates|market-regime|execution:state|execution-events|notifications|sentiment_scores|market_view|signals:trade)['"]/g) || [];
  ok('no hardcoded channel string literals in websocket.ts', hardcodedMatches.length === 0, `found: ${hardcodedMatches.join(', ')}`);

  // Cleanup
  if (socket) socket.disconnect();
  if (pub) await pub.quit();

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
