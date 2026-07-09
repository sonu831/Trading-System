/**
 * Regression tests for the paper execution path.
 * Run: npm run verify:paper
 *
 * These encode bugs that were found in a 2026-07-09 audit and MUST NOT regress:
 *  - entryPrice must be the OPTION PREMIUM, never the index spot
 *  - P&L must include lotSize, and must NOT be sign-flipped for PE (we are long premium)
 *  - lot sizing must use lotSize and may return 0 (reject) instead of forcing 1 lot
 *  - trailing stop must ratchet, not exit on any pullback from the peak
 */
process.env.LOG_LEVEL = 'silent';

const { RiskManager } = require('../src/risk/manager');
const { PositionManager } = require('../src/risk/position-manager');
const { StrikeSelector } = require('../src/strike-selector');
const { PaperExecutor } = require('../src/paper-executor');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

const config = {
  tradeMode: 'paper',
  instrument: { underlying: 'NIFTY', lotSize: 75, strikeStep: 50, expiryWeekday: 2, expiryRollAfter: '12:00' },
  strike: { moneyness: 'ATM', maxSpreadPct: 0.5, minOpenInterest: 50000 },
  strategy: { stopLossPct: 18, targetPct: 25, trailingTriggerPct: 12, trailingStepPct: 6, timeStopMinutes: 10 },
  risk: { maxConcurrentPositions: 1, maxTradesPerDay: 5, maxDailyLoss: 2500, capitalAtRisk: 25000, maxLots: 3, entryCutoff: '23:59', squareOffTime: '23:59' },
};

class StubFeed {
  constructor(ask) { this.q = {}; this.ask = ask; }
  async primeSymbol(s) { this.q[s] = { ltp: this.ask, bid: this.ask * 0.99, ask: this.ask, oi: 0 }; return this.q[s]; }
  getQuote(s) { return this.q[s] || null; }
  releaseSymbol(s) { delete this.q[s]; }
  setLtp(s, ltp) { this.q[s] = { ltp, bid: ltp * 0.99, ask: ltp * 1.01, oi: 0 }; }
}
const journal = { recordTrade: async () => {}, recordOrder: async () => {}, recordPnlSnapshot: async () => {} };

console.log('\nA. RiskManager.calculateLots');
{
  const rm = new RiskManager(config);
  ok('affordable premium -> capped at maxLots(3)', rm.calculateLots(100, {}) === 3);
  ok('unaffordable premium -> 0 lots (reject, not forced 1)', rm.calculateLots(3000, {}) === 0);
  ok('zero/undefined premium -> 0 lots', rm.calculateLots(0, {}) === 0 && rm.calculateLots(undefined, {}) === 0);
}

console.log('\nB. PositionManager P&L (lotSize applied; long premium for CE and PE)');
{
  const pm = new PositionManager(config);
  const inst = { nfoSymbol: 'NIFTY26JUL0925000CE', strike: 25000, expiry: '2026-07-09', optionType: 'CE', lotSize: 75 };
  const ce = pm.openPosition({ direction: 'LONG', optionType: 'CE', params: {} }, 2, 100, inst);
  ok('entryPrice is the premium, not the spot', ce.entryPrice === 100);
  ok('nfoSymbol persisted (quotes depend on it)', ce.nfoSymbol === inst.nfoSymbol);
  pm.updatePrice(ce.id, 120);
  ok('CE pnl = (120-100)*2*75 = 3000', near(ce.pnl, 3000), String(ce.pnl));
  ok('CE pnlPct = 20', near(ce.pnlPct, 20));

  const pe = pm.openPosition({ direction: 'SHORT', optionType: 'PE', params: {} }, 2, 100, { ...inst, nfoSymbol: 'NIFTY26JUL0925000PE', optionType: 'PE' });
  pm.updatePrice(pe.id, 120);
  ok('PE (direction SHORT) pnl POSITIVE when premium rises', pe.pnl > 0, String(pe.pnl));
  ok('PE pnl = +3000 (not sign-flipped)', near(pe.pnl, 3000), String(pe.pnl));
}

console.log('\nC. Trailing stop ratchets');
{
  const pm = new PositionManager(config);
  const inst = { nfoSymbol: 'X', strike: 1, expiry: '2026-07-09', optionType: 'CE', lotSize: 75 };
  const p = pm.openPosition({ direction: 'LONG', optionType: 'CE', params: { trailingTriggerPct: 12, trailingStepPct: 6, targetPct: 999, stopLossPct: 99, timeStopMinutes: 9999 } }, 1, 100, inst);
  pm.updatePrice(p.id, 115);
  ok('no exit at activation (+15%)', pm.checkExits(p) === null);
  ok('stop set to 9%', p.trailingActive && near(p.trailingSlip, 9));
  pm.updatePrice(p.id, 112);
  ok('pullback above the stop does NOT exit', pm.checkExits(p) === null);
  pm.updatePrice(p.id, 120); pm.checkExits(p);
  ok('stop ratchets to 14%', near(p.trailingSlip, 14));
  pm.updatePrice(p.id, 113);
  const ex = pm.checkExits(p);
  ok('exits at the ratcheted stop', ex && ex.reason === 'trailing_stop_hit');
}

console.log('\nD. PaperExecutor end-to-end');
(async () => {
  const rm = new RiskManager(config);
  const pm = new PositionManager(config);
  const feed = new StubFeed(150);
  const ex = new PaperExecutor(config, rm, pm, new StrikeSelector(config), journal, feed);
  const signal = { strategyId: 'momentum-burst', tier: 'T1', symbol: 'NIFTY', direction: 'LONG', optionType: 'CE', spotPrice: 25000, action: 'BUY', params: { stopLossPct: 18, targetPct: 25 } };

  const pos = await ex.executeSignal(signal);
  ok('position opened', !!pos);
  ok('entryPrice == option ask (150), NOT spot (25000)', pos.entryPrice === 150, String(pos.entryPrice));
  ok('ATM strike 25000 resolved', pos.strike === 25000);
  ok('trade counted at entry', rm.getState().dailyState.tradesToday === 1);

  await ex.checkExits();
  ok('NO instant stop_loss at flat price', pm.getOpenPositions().length === 1);

  feed.setLtp(pos.nfoSymbol, 195);
  await ex.checkExits();
  const closed = pm.getPosition(pos.id);
  ok('target hit closes position', closed.status === 'CLOSED');
  ok('exit reason target_hit', closed.exitReason === 'target_hit');
  ok('realised pnl positive', closed.pnl > 0, String(closed.pnl));

  console.log('\nE. Risk breaker + kill switch');
  const rm2 = new RiskManager(config);
  let persisted = null;
  rm2.onKillSwitchChange = (a) => { persisted = a; };
  rm2.recordTrade({ pnl: -3000 });
  ok('daily-loss breaker trips kill switch', rm2.killSwitch === true);
  ok('kill switch persisted (survives restart)', persisted === true);
  const gate = await rm2.canEnter({}, []);
  ok('canEnter blocked by kill switch', gate.allowed === false && gate.reason === 'kill_switch_active');

  console.log('\nF. PaperExecutor refuses live mode');
  let threw = false;
  try { new PaperExecutor({ ...config, tradeMode: 'live' }, rm, pm, new StrikeSelector(config), journal, feed); } catch (_) { threw = true; }
  ok('TRADE_MODE=live throws in PaperExecutor', threw);

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
