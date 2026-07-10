/**
 * Regression: constants.js (Node) and constants.go (Go) must never drift.
 *
 * Why this exists: commit 7c2f6ea deleted shared/constants.ts and left a 379-byte
 * constants.js holding only BROKER_BASE_URLS and REDIS_KEYS. constants.go kept all
 * eight Kafka topics. Node consumers resolved `KAFKA_TOPICS.OPTION_CHAIN` to
 * `undefined` and subscribed to a topic named "undefined"; Go kept working. Nothing
 * failed loudly. This test makes that failure loud.
 *
 * Run: node shared/tests/constants-parity.test.js
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const js = require('../constants.js');
const goSrc = fs.readFileSync(path.join(__dirname, '..', 'constants.go'), 'utf8');
const barrelSrc = fs.readFileSync(path.join(__dirname, '..', 'index.ts'), 'utf8');

let failures = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
};

/** Parse `Name = "value"` / `Name = 1234` out of the Go const block. */
function goConstants() {
  const out = {};
  for (const line of goSrc.split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Za-z0-9]*)\s*=\s*(?:"([^"]*)"|(\d+))\s*$/);
    if (m) out[m[1]] = m[2] !== undefined ? m[2] : Number(m[3]);
  }
  return out;
}

const go = goConstants();

console.log('constants parity (Node <-> Go)\n');

check('Go const block parsed', () => {
  assert.ok(Object.keys(go).length > 20, `parsed only ${Object.keys(go).length} Go constants`);
});

// ── Kafka topics: every Go topic must exist in JS with the identical value ──
const TOPIC_MAP = {
  TopicRawTicks: 'RAW_TICKS',
  TopicMarketCandles: 'MARKET_CANDLES',
  TopicAnalysisUpdates: 'ANALYSIS_UPDATES',
  TopicSentimentScores: 'SENTIMENT_SCORES',
  TopicTradeSignals: 'TRADE_SIGNALS',
  TopicOptionChain: 'OPTION_CHAIN',
  TopicMarketRegime: 'MARKET_REGIME',
  TopicExecutionEvents: 'EXECUTION_EVENTS',
};

check('KAFKA_TOPICS exists in constants.js', () => {
  assert.ok(js.KAFKA_TOPICS, 'constants.js does not export KAFKA_TOPICS');
});

for (const [goName, jsKey] of Object.entries(TOPIC_MAP)) {
  check(`topic ${goName} === KAFKA_TOPICS.${jsKey}`, () => {
    assert.ok(goName in go, `${goName} missing from constants.go`);
    assert.strictEqual(js.KAFKA_TOPICS?.[jsKey], go[goName]);
  });
}

// ── Ports: same name, same number ──
const PORT_MAP = {
  PortBackendAPI: 'BACKEND_API',
  PortIngestion: 'INGESTION',
  PortProcessing: 'PROCESSING',
  PortAnalysis: 'ANALYSIS',
  PortAggregation: 'AGGREGATION',
  PortSignal: 'SIGNAL',
  PortExecution: 'EXECUTION',
};

for (const [goName, jsKey] of Object.entries(PORT_MAP)) {
  check(`port ${goName} === PORTS.${jsKey}`, () => {
    assert.ok(goName in go, `${goName} missing from constants.go`);
    assert.strictEqual(js.PORTS?.[jsKey], go[goName]);
  });
}

// ── Enum values shared across both languages ──
const ENUM_MAP = {
  TrendUp: ['REGIME_TREND', 'UP'],
  TrendDown: ['REGIME_TREND', 'DOWN'],
  TrendRange: ['REGIME_TREND', 'RANGE'],
  SentimentBullish: ['REGIME_SENTIMENT', 'BULLISH'],
  SentimentBearish: ['REGIME_SENTIMENT', 'BEARISH'],
  VolatilityExtreme: ['REGIME_VOLATILITY', 'EXTREME'],
  PhaseBreakout: ['REGIME_PHASE', 'BREAKOUT'],
  SectorStrongUp: ['SECTOR_MOMENTUM', 'STRONG_UP'],
  TierT1: ['SIGNAL_TIER', 'T1'],
  TierT3: ['SIGNAL_TIER', 'T3'],
};

for (const [goName, [jsEnum, jsKey]] of Object.entries(ENUM_MAP)) {
  check(`enum ${goName} === ${jsEnum}.${jsKey}`, () => {
    assert.ok(goName in go, `${goName} missing from constants.go`);
    assert.strictEqual(js[jsEnum]?.[jsKey], go[goName]);
  });
}

// ── The barrel must re-export everything constants.js exports ──
// An omitted name is not a type error; `import { X } from '@shared'` just yields undefined.
check('index.ts re-exports every constants.js export', () => {
  const exported = Object.keys(js);
  const block = barrelSrc.match(/export\s*\{([\s\S]*?)\}\s*from\s*'\.\/constants'/);
  assert.ok(block, "no `export { ... } from './constants'` block in index.ts");
  const reExported = new Set(
    block[1].split(',').map((s) => s.trim()).filter(Boolean),
  );
  const missing = exported.filter((name) => !reExported.has(name));
  assert.deepStrictEqual(missing, [], `not re-exported by index.ts: ${missing.join(', ')}`);
});

// ── No .ts twin may shadow constants.js ──
check('no shared/constants.ts shadowing constants.js', () => {
  const twin = path.join(__dirname, '..', 'constants.ts');
  assert.ok(!fs.existsSync(twin), 'shared/constants.ts exists and will shadow constants.js for tsc');
});

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} assertion(s)`}`);
process.exit(failures === 0 ? 0 : 1);
