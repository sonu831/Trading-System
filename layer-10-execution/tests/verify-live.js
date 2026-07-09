/**
 * Safety-invariant tests for the LIVE execution path (mock broker — places no real orders).
 * Run: npm run verify:live
 *
 * These encode the invariants in src/live-executor.js. If any of these fail, DO NOT trade live:
 *  1. We only ever BUY premium (CE for LONG, PE for SHORT). Never sell to open.
 *  2. Entry + resting SL-M are atomic; if the SL cannot be placed we flatten immediately.
 *  3. The broker is the source of truth: positions open only on a confirmed fill, at the fill price.
 *  4. Every order carries an ordertag.
 *  5. It fails closed unless explicitly armed and the OMS supports stops + fill confirmation.
 */
process.env.LOG_LEVEL = 'silent';

const { RiskManager } = require('../src/risk/manager');
const { PositionManager } = require('../src/risk/position-manager');
const { StrikeSelector } = require('../src/strike-selector');
const { LiveExecutor } = require('../src/live-executor');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };

const config = {
  tradeMode: 'live',
  instrument: { underlying: 'NIFTY', lotSize: 75, strikeStep: 50, expiryWeekday: 2, expiryRollAfter: '12:00' },
  strike: { moneyness: 'ATM', maxSpreadPct: 0.5, minOpenInterest: 50000 },
  strategy: { stopLossPct: 18, targetPct: 25 },
  risk: { maxConcurrentPositions: 1, maxTradesPerDay: 5, maxDailyLoss: 2500, capitalAtRisk: 25000, maxLots: 3, entryCutoff: '23:59', squareOffTime: '23:59' },
  oms: { orderTagPrefix: 'SCLP' },
  kafka: { topics: { executionEvents: 'execution-events' } },
};

class MockOMS {
  constructor(opts = {}) { this.name = 'mock'; this.orders = []; this.failSL = !!opts.failSL; this.seq = 0; this.marketPrice = 150; }
  supportsRestingStop() { return true; }
  async placeOrder(o) {
    if (this.failSL && o.orderType === 'SL-MKT') throw new Error('SL rejected by broker');
    const orderId = `O${++this.seq}`;
    this.orders.push({ ...o, orderId });
    return { orderId, raw: {} };
  }
  async getOrderStatus(orderId) {
    const o = this.orders.find((x) => x.orderId === orderId);
    if (!o) return null;
    if (o.orderType === 'SL-MKT') return { status: 'TRIGGER_PENDING', filledQty: 0, avgPrice: 0 };
    const avgPrice = o.orderType === 'MKT' ? this.marketPrice : o.price; // MKT fills at market
    return { status: 'COMPLETE', filledQty: o.quantity, avgPrice, raw: {} };
  }
  async cancelOrder() { return { stat: 'Ok' }; }
  async getQuote() { return { ltp: this.marketPrice, bid: this.marketPrice * 0.99, ask: this.marketPrice, oi: 0 }; }
  async disconnect() {}
  ordersOfType(t) { return this.orders.filter((o) => o.orderType === t); }
}

class StubFeed {
  constructor(ask) { this.q = {}; this.ask = ask; }
  async primeSymbol(s) { this.q[s] = { ltp: this.ask, bid: this.ask * 0.99, ask: this.ask, oi: 0 }; return this.q[s]; }
  getQuote(s) { return this.q[s] || null; }
  releaseSymbol(s) { delete this.q[s]; }
  setLtp(s, ltp) { this.q[s] = { ltp, bid: ltp * 0.99, ask: ltp * 1.01, oi: 0 }; }
}
const journal = { recordTrade: async () => {}, recordOrder: async () => {}, recordPnlSnapshot: async () => {} };

const EXPECTED_FILL = Math.round(150 * 1.005 * 20) / 20; // marketable limit, 0.05 tick => 150.75

const build = (o = {}) => {
  const oms = new MockOMS(o);
  const rm = new RiskManager(config);
  const pm = new PositionManager(config);
  const feed = new StubFeed(150);
  const ex = new LiveExecutor(config, rm, pm, new StrikeSelector(config), journal, feed, oms, null);
  return { oms, rm, pm, feed, ex };
};

(async () => {
  console.log('\nA. Fails closed');
  delete process.env.LIVE_TRADING_ARMED;
  { let t = false; try { build(); } catch (e) { t = /LIVE_TRADING_ARMED/.test(e.message); } ok('refuses unless LIVE_TRADING_ARMED=true', t); }
  process.env.LIVE_TRADING_ARMED = 'true';
  { let t = false; try { new LiveExecutor(config, new RiskManager(config), new PositionManager(config), new StrikeSelector(config), journal, new StubFeed(150), { name: 'x', supportsRestingStop: () => false, getOrderStatus: () => {} }, null); } catch (e) { t = /resting stop-loss/.test(e.message); } ok('refuses OMS without resting stop', t); }
  { let t = false; try { new LiveExecutor(config, new RiskManager(config), new PositionManager(config), new StrikeSelector(config), journal, new StubFeed(150), { name: 'x', supportsRestingStop: () => true }, null); } catch (e) { t = /confirm fills/.test(e.message); } ok('refuses OMS without fill confirmation', t); }

  console.log('\nB. Bullish -> BUY CE + resting SL-M');
  {
    const { oms, ex, pm } = build();
    const pos = await ex.executeSignal({ direction: 'LONG', symbol: 'NIFTY', spotPrice: 25000, params: { stopLossPct: 18 } });
    const entry = oms.ordersOfType('LMT')[0];
    ok('position opened', !!pos);
    ok('entry is BUY', entry.action === 'BUY');
    ok('entry symbol is CE', /CE$/.test(entry.symbol));
    ok('entry validity IOC', entry.validity === 'IOC');
    ok('entry product INTRADAY', entry.productType === 'INTRADAY');
    ok('entry has ordertag', !!entry.ordertag);
    const sl = oms.ordersOfType('SL-MKT')[0];
    ok('resting SL-M placed', !!sl);
    ok('SL is SELL (close the long)', sl.action === 'SELL');
    const expectedTrigger = Math.round(EXPECTED_FILL * 0.82 * 20) / 20;
    ok(`SL trigger from FILL (${EXPECTED_FILL}) = ${expectedTrigger}`, Math.abs(sl.triggerPrice - expectedTrigger) < 1e-9, String(sl.triggerPrice));
    ok('entryPrice = broker fill, not the ask', pos.entryPrice === EXPECTED_FILL, String(pos.entryPrice));
    ok('slOrderId recorded', !!pos.slOrderId);
    ok('one open position', pm.getOpenPositions().length === 1);
  }

  console.log('\nC. Bearish -> BUY PE (never sell to open)');
  {
    const { oms, ex } = build();
    await ex.executeSignal({ direction: 'SHORT', symbol: 'NIFTY', spotPrice: 25000, params: { stopLossPct: 18 } });
    const entry = oms.ordersOfType('LMT')[0];
    ok('entry is BUY (not SELL)', entry.action === 'BUY', entry.action);
    ok('entry symbol is PE', /PE$/.test(entry.symbol), entry.symbol);
    ok('ZERO sell-to-open orders', oms.orders.filter((o) => o.action === 'SELL' && o.orderType === 'LMT').length === 0);
  }

  console.log('\nD. SL placement fails -> emergency flatten');
  {
    const { oms, ex, pm } = build({ failSL: true });
    const pos = await ex.executeSignal({ direction: 'LONG', symbol: 'NIFTY', spotPrice: 25000, params: { stopLossPct: 18 } });
    ok('no position kept when SL fails', pos === null);
    ok('no open positions', pm.getOpenPositions().length === 0);
    const flat = oms.orders.filter((o) => o.orderType === 'MKT' && o.action === 'SELL');
    ok('emergency market SELL issued', flat.length >= 1);
    ok('flatten tagged _PANIC', flat.some((o) => /_PANIC$/.test(o.ordertag)));
  }

  console.log('\nE. Exit: cancel SL, market SELL, price from broker fill');
  {
    const { oms, ex, pm, feed } = build();
    const pos = await ex.executeSignal({ direction: 'LONG', symbol: 'NIFTY', spotPrice: 25000, params: { stopLossPct: 18, targetPct: 25 } });
    feed.setLtp(pos.nfoSymbol, 200);
    oms.marketPrice = 200;
    await ex.checkExits();
    const closed = pm.getPosition(pos.id);
    ok('position closed', closed.status === 'CLOSED');
    ok('reason target_hit', closed.exitReason === 'target_hit');
    ok('one market SELL to close', oms.orders.filter((o) => o.orderType === 'MKT' && o.action === 'SELL').length === 1);
    ok('exit price = broker fill (200)', closed.exitPrice === 200);
    const expectedPnl = (200 - EXPECTED_FILL) * closed.lots * 75;
    ok(`pnl exact (${expectedPnl})`, Math.abs(closed.pnl - expectedPnl) < 1e-6, String(closed.pnl));
  }

  console.log('\nF. Unfilled IOC -> no position, no SL');
  {
    const oms = new MockOMS();
    oms.getOrderStatus = async () => ({ status: 'CANCELED', filledQty: 0, avgPrice: 0 });
    const pm = new PositionManager(config);
    const ex = new LiveExecutor(config, new RiskManager(config), pm, new StrikeSelector(config), journal, new StubFeed(150), oms, null);
    const pos = await ex.executeSignal({ direction: 'LONG', symbol: 'NIFTY', spotPrice: 25000, params: {} });
    ok('no position on unfilled entry', pos === null);
    ok('no SL placed', oms.ordersOfType('SL-MKT').length === 0);
    ok('no open positions', pm.getOpenPositions().length === 0);
  }

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
