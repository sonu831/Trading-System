/**
 * Verifies the L7 -> L10 execution proxy against a stand-in engine.
 * Run:  node tests/verify-execution-proxy.js
 *
 * Invariants:
 *  - `killSwitch` is normalised out of `risk{}` when the engine omits it at top level.
 *  - An unreachable or erroring engine THROWS (503) — the API never fabricates a state,
 *    because the dashboard renders "—"/"ENGINE OFFLINE" rather than a confident zero.
 *  - Read timeouts are short so a hung engine cannot hang the API (and hide the kill switch).
 */
const http = require('http');
const path = require('path');
const ExecutionService = require(path.join(__dirname, '..', 'src', 'modules', 'execution', 'ExecutionService'));

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };

const PORT = 8199;

// Stand-in L10 that deliberately omits top-level killSwitch (older engine shape).
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'GET' && req.url === '/state') {
    return res.end(JSON.stringify({
      mode: 'paper',
      positions: [{ id: 'p1', status: 'OPEN', pnl: 150 }],
      risk: { killSwitch: true, dailyState: { tradesToday: 2, totalPnl: -300 }, maxDailyLoss: 2500 },
    }));
  }
  if (req.method === 'POST' && req.url === '/square-off') {
    return res.end(JSON.stringify({ killSwitch: false, positions: [] }));
  }
  if (req.method === 'POST' && req.url === '/kill') {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'square-off failed at broker' }));
  }
  res.statusCode = 404;
  res.end('{}');
});

(async () => {
  await new Promise((r) => server.listen(PORT, r));

  console.log('\nA. State normalisation');
  process.env.EXECUTION_URL = `http://127.0.0.1:${PORT}`;
  const svc = new ExecutionService();
  const state = await svc.getState();
  ok('mode passed through', state.mode === 'paper');
  ok('killSwitch lifted out of risk{} when absent at top level', state.killSwitch === true);
  ok('positions is an array', Array.isArray(state.positions) && state.positions.length === 1);
  ok('risk object preserved', state.risk?.maxDailyLoss === 2500);
  ok('timestamp synthesised when engine omits it', typeof state.timestamp === 'string');

  console.log('\nB. Mutations');
  const sq = await svc.squareOff();
  ok('square-off returns engine payload', sq.killSwitch === false && Array.isArray(sq.positions));

  console.log('\nC. Engine errors surface honestly');
  let killErr = null;
  try { await svc.kill(); } catch (e) { killErr = e; }
  ok('engine 500 -> throws with its message', killErr && /square-off failed at broker/.test(killErr.message));
  ok('engine 500 -> statusCode 500', killErr && killErr.statusCode === 500);

  console.log('\nD. Unreachable engine -> 503, never a fabricated state');
  await new Promise((r) => server.close(r));
  let downErr = null;
  try { await new ExecutionService().getState(); } catch (e) { downErr = e; }
  ok('throws (does not return a default state)', downErr !== null);
  ok('statusCode 503', downErr && downErr.statusCode === 503);
  ok('message names the engine as unreachable', downErr && /unreachable/i.test(downErr.message));

  console.log('\nE. Timeouts configured');
  const s2 = new ExecutionService();
  ok('read timeout is short', s2.readTimeoutMs > 0 && s2.readTimeoutMs <= 5000);
  ok('write timeout longer than read', s2.writeTimeoutMs > s2.readTimeoutMs);

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
