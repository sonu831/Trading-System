/**
 * OptionSimulator tests (Research plane).
 *
 * The single most important assertion here is that every output is stamped SYNTHETIC.
 * These premiums are Black-Scholes at a constant 15% IV — a strategy ranking, not a P&L
 * forecast — and rule 13 forbids ever presenting a fabricated value as real.
 *
 * Run: node --import tsx tests/option-simulator.test.ts
 */
const { OptionSimulator } = require('../option-simulator');

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra = ''): void {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${extra ? `: ${extra}` : ''}`); }
}

const sim = new OptionSimulator();

const bull = sim.simulateTrade(
  { direction: 'LONG', optionType: 'CE', lots: 1, params: {} },
  { entry: { price: 25000, time: '2026-07-01T09:30:00Z' }, exit: { price: 25300, time: '2026-07-01T10:30:00Z' }, expiry: '2026-07-03' },
);

console.log('Rule 13: provenance stamps');
ok('result is flagged synthetic', bull.synthetic === true);
ok("source === 'synthetic'", bull.source === 'synthetic');
ok('pricing model is declared', bull.model === 'black-scholes');

console.log('\nLong-premium P&L behaves correctly');
ok('CE gains when spot rises', bull.pnl > 0, String(bull.pnl));
ok('entry premium is a positive number, not the spot', bull.entryPremium > 0 && bull.entryPremium < 25000, String(bull.entryPremium));

const bear = sim.simulateTrade(
  { direction: 'SHORT', optionType: 'PE', lots: 1, params: {} },
  { entry: { price: 25000, time: '2026-07-01T09:30:00Z' }, exit: { price: 24700, time: '2026-07-01T10:30:00Z' }, expiry: '2026-07-03' },
);
ok('PE gains when spot falls (long premium, not sign-flipped)', bear.pnl > 0, String(bear.pnl));

console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail > 0 ? 1 : 0);
