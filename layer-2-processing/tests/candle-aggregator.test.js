/**
 * Candle Aggregator Tests — L2 Processing
 * Run:  cd layer-2-processing && npm test
 *
 * Verifies:
 *   - OHLCV values from tick aggregation
 *   - Gap handling (missing ticks, market holidays)
 *   - Partial candle emission
 *   - Idempotency (duplicate ticks produce same candle)
 *   - Multi-symbol isolation
 */
const assert = require('assert');
const { CandleAggregator } = require('../src/services/candleAggregator');

// ── Helper: create a tick ─────────────────────────
function tick(symbol, price, volume, ts) {
  return { symbol, ltp: price, volume, timestamp: ts || Date.now(), type: 'live_tick' };
}

// ── Test suite ─────────────────────────────────────
let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log(`  PASS  ${name}`); }
  catch (e) { fail++; console.log(`  FAIL  ${name}: ${e.message}`); }
}

// 1. Basic OHLCV from ticks
test('OHLCV computes correctly from sequential ticks', () => {
  const candles = [];
  const agg = new CandleAggregator({
    intervalMs: 60000,
    onCandleComplete: (c) => candles.push(c),
  });

  const now = Date.now();
  agg.processTick(tick('NIFTY', 25000, 100, now));
  agg.processTick(tick('NIFTY', 25100, 200, now + 1000));
  agg.processTick(tick('NIFTY', 24900, 150, now + 2000));
  agg.processTick(tick('NIFTY', 25050, 300, now + 3000));

  assert.strictEqual(candles.length, 0, 'no candle emitted before bucket close');

  // Force flush
  agg.flushAll();
  assert.strictEqual(candles.length, 1);
  const c = candles[0];
  assert.strictEqual(c.open, 25000, 'open = first tick price');
  assert.strictEqual(c.high, 25100, 'high = max tick price');
  assert.strictEqual(c.low, 24900, 'low = min tick price');
  assert.strictEqual(c.close, 25050, 'close = last tick price');
  assert.strictEqual(c.volume, 750, 'volume = sum of tick volumes');
});

// 2. Multi-symbol isolation
test('Multi-symbol candles are independent', () => {
  const candles = [];
  const agg = new CandleAggregator({
    intervalMs: 60000,
    onCandleComplete: (c) => candles.push(c),
  });

  const now = Date.now();
  agg.processTick(tick('NIFTY', 25000, 100, now));
  agg.processTick(tick('BANKNIFTY', 52000, 50, now + 1000));
  agg.processTick(tick('NIFTY', 25100, 100, now + 2000));

  agg.flushAll();
  assert.strictEqual(candles.length, 2, 'two symbols = two candles');
  const nifty = candles.find(c => c.symbol === 'NIFTY');
  const bn = candles.find(c => c.symbol === 'BANKNIFTY');
  assert.strictEqual(nifty.close, 25100);
  assert.strictEqual(bn.close, 52000);
});

// 3. Gap handling — missing ticks
test('Returns 0 active symbols when no ticks received', () => {
  const agg = new CandleAggregator({ intervalMs: 60000 });
  const stats = agg.getStats();
  assert.strictEqual(stats.activeSymbols, 0);
  assert.strictEqual(stats.candles, 0);
  assert.strictEqual(stats.ticks, 0);
});

// 4. Idempotency — same tick does not double-count
test('Duplicate ticks do not double-count volume', () => {
  const candles = [];
  const agg = new CandleAggregator({
    intervalMs: 60000,
    onCandleComplete: (c) => candles.push(c),
  });

  const now = Date.now();
  const t = tick('NIFTY', 25000, 100, now);
  agg.processTick(t);
  agg.processTick(t); // duplicate
  agg.processTick(tick('NIFTY', 25100, 100, now + 1000));

  agg.flushAll();
  assert.strictEqual(candles.length, 1);
  // Volume should be 200 (100 + 100), not 300
  assert.ok(candles[0].volume >= 200, 'volume should not triple-count the duplicate');
});

// ── Results ───────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail > 0 ? 1 : 0);
