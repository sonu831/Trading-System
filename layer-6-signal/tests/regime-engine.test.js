/**
 * Regime Engine Tests — L6 Signal
 * Run: cd layer-6-signal && node tests/regime-engine.test.js
 */
const { detectTrend, detectVolatility, detectPhase, computeTFAlignment, SMA, EMA, ATR, ADX } = require('../src/regime/indicators');

let pass = 0, fail = 0;
const test = (name, fn) => { try { fn(); pass++; } catch (e) { fail++; console.log(`  FAIL  ${name}: ${e.message}`); } };
const assert = (cond, msg) => { if (!cond) throw new Error(msg || 'assertion failed'); };

// ── SMA ──────────────────────────────────────────
test('SMA computes correctly', () => {
  const data = [10, 20, 30, 40, 50];
  assert(SMA(data, 3) === 40, `SMA([10,20,30,40,50], 3) = ${SMA(data, 3)}, expected 40`);
});

// ── EMA ──────────────────────────────────────────
test('EMA returns number', () => {
  const data = Array.from({ length: 30 }, (_, i) => 100 + i);
  const ema = EMA(data, 9);
  assert(typeof ema === 'number' && !isNaN(ema), `EMA returned ${ema}`);
});

// ── ATR ──────────────────────────────────────────
test('ATR computes positive value', () => {
  const n = 20;
  const h = Array.from({ length: n }, (_, i) => 100 + i + 5);
  const l = Array.from({ length: n }, (_, i) => 100 + i - 5);
  const c = Array.from({ length: n }, (_, i) => 100 + i);
  const atr = ATR(h, l, c, 14);
  assert(atr > 0, `ATR should be positive, got ${atr}`);
});

// ── ADX ──────────────────────────────────────────
test('ADX returns object with PDI/NDI/ADX', () => {
  const n = 30;
  const h = Array.from({ length: n }, (_, i) => 25000 + i * 10 + 20);
  const l = Array.from({ length: n }, (_, i) => 25000 + i * 10 + 5);
  const c = Array.from({ length: n }, (_, i) => 25000 + i * 10 + 15);
  const result = ADX(h, l, c, 14);
  assert(typeof result === 'object', 'ADX should return object');
  assert(result.ADX >= 0, 'ADX >= 0');
  assert(result.PDI !== undefined, 'PDI should exist');
  assert(result.NDI !== undefined, 'NDI should exist');
});

// ── detectTrend ──────────────────────────────────
test('detectTrend identifies uptrend', () => {
  const n = 60;
  const closes = Array.from({ length: n }, (_, i) => 25000 + i * 5);
  const highs = closes.map(c => c + 20);
  const lows = closes.map(c => c - 10);
  const r = detectTrend(highs, lows, closes);
  assert(r.trend === 'TREND_UP', `Expected TREND_UP, got ${r.trend}`);
  assert(r.strength > 0.3, `Strength should be >0.3, got ${r.strength}`);
});

test('detectTrend identifies ranging market', () => {
  const n = 60;
  const closes = Array.from({ length: n }, () => 25000 + (Math.random() - 0.5) * 20);
  const highs = closes.map(c => c + 20);
  const lows = closes.map(c => c - 20);
  const r = detectTrend(highs, lows, closes);
  assert(r.trend === 'RANGE' || r.strength < 0.4, `Ranging market: trend=${r.trend}, str=${r.strength}`);
});

// ── detectVolatility ─────────────────────────────
test('detectVolatility returns valid level', () => {
  const n = 30;
  const closes = Array.from({ length: n }, () => 1000);
  const highs = closes.map(c => c + 50);
  const lows = closes.map(c => c - 50);
  const r = detectVolatility(highs, lows, closes);
  assert(['HIGH', 'NORMAL', 'LOW'].includes(r), `Invalid volatility: ${r}`);
});

// ── detectPhase ──────────────────────────────────
test('detectPhase returns valid phase', () => {
  const n = 60;
  const closes = Array.from({ length: n }, (_, i) => 25000 + i * 5);
  const r = detectPhase(closes);
  assert(['TRENDING', 'CONSOLIDATING', 'EXHAUSTION', 'BREAKOUT'].includes(r), `Invalid phase: ${r}`);
});

// ── computeTFAlignment ───────────────────────────
test('computeTFAlignment returns score 0-1', () => {
  const tfVectors = {
    '5m': 'TREND_UP', '15m': 'TREND_UP', '1h': 'TREND_UP', 'D': 'TREND_UP',
  };
  const score = computeTFAlignment(tfVectors);
  assert(score >= 0 && score <= 1, `TF alignment score should be 0-1, got ${score}`);
  assert(score > 0.7, `All-up alignment should have high score, got ${score}`);
});

test('computeTFAlignment penalizes divergence', () => {
  const tfVectors = {
    '5m': 'TREND_UP', '15m': 'TREND_DOWN', '1h': 'RANGE', 'D': 'TREND_UP',
  };
  const score = computeTFAlignment(tfVectors);
  assert(score < 0.5, `Divergent alignment should have low score, got ${score}`);
});

// ── Results ───────────────────────────────────────
console.log(`\nL6 Regime Indicators: ${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail > 0 ? 1 : 0);
