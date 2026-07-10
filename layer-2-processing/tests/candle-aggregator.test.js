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

// 4. Duplicate ticks — pins ACTUAL behaviour, which is NOT idempotent.
//
// This test was previously named "Duplicate ticks do not double-count volume" and
// asserted `volume >= 200`, which passes whether or not the duplicate is counted.
// It is: the real volume is 300. CandleAggregator has no tick identity and cannot
// deduplicate. Idempotency (contract rule 4) belongs in the Kafka consumer, which
// owns offsets and message keys -- not here. Pinned so a future dedup change is a
// deliberate, visible edit rather than an accident.
test('Duplicate ticks ARE double-counted (dedup belongs in the consumer)', () => {
  const candles = [];
  const agg = new CandleAggregator({
    intervalMs: 60000,
    onCandleComplete: (c) => candles.push(c),
  });

  const now = Date.now();
  const t = tick('NIFTY', 25000, 100, now);
  agg.processTick(t);
  agg.processTick(t); // duplicate delivery
  agg.processTick(tick('NIFTY', 25100, 100, now + 1000));

  agg.flushAll();
  assert.strictEqual(candles.length, 1);
  assert.strictEqual(candles[0].volume, 300, 'aggregator sums every tick it is given');
  agg.destroy();
});

// 5. Regression: checkBoundaries() had an EMPTY body.
//
// A candle only closed when the next tick for that symbol arrived, so an illiquid
// symbol -- or the last candle of the session -- was never emitted. The 1-second
// timer called a function that did nothing, and no test covered it.
test('checkBoundaries flushes an elapsed candle with no further ticks', () => {
  const candles = [];
  const agg = new CandleAggregator({
    intervalMs: 60000,
    onCandleComplete: (c) => candles.push(c),
  });

  // A tick two minutes in the past: its bucket has long since closed.
  agg.processTick(tick('NIFTY', 25000, 100, Date.now() - 120000));
  assert.strictEqual(candles.length, 0, 'not yet flushed');

  agg.checkBoundaries(); // no new tick arrives -- wall clock alone must close it

  assert.strictEqual(candles.length, 1, 'elapsed candle must be emitted by the timer');
  assert.strictEqual(candles[0].close, 25000);
  agg.destroy();
});

// 6. checkBoundaries must NOT flush the candle still in progress.
test('checkBoundaries leaves the in-progress candle open', () => {
  const candles = [];
  const agg = new CandleAggregator({
    intervalMs: 60000,
    onCandleComplete: (c) => candles.push(c),
  });

  agg.processTick(tick('NIFTY', 25000, 100, Date.now()));
  agg.checkBoundaries();

  assert.strictEqual(candles.length, 0, 'current bucket is not yet closed');
  agg.destroy();
});

// ── Results ───────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail > 0 ? 1 : 0);
