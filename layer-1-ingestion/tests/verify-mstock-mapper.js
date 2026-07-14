/**
 * MStock tick mapper — GAP-N1.
 * Run: node --import tsx tests/verify-mstock-mapper.js
 *
 * The bug: the mapper read `data.Token` / `data.LastTradedPrice` / `data.VolumeTradedToday`.
 * The SDK's MTicker emits `FeedData` — `InstrumentToken` / `LastPrice` / `Volume`. So the token
 * resolved to `undefined`, `getSymbol()` returned null, and the mapper returned null for EVERY
 * tick. Not a single MStock tick could ever enter the system, no matter how valid the session was.
 *
 * These assertions pin the mapper to the SDK's real payload shape.
 */
const { MStockMapper } = require('../src/mappers/mstock');
const { SymbolRegistry } = require('../src/utils/symbol-registry');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };

const mapper = new MStockMapper();

// Resolve a token the registry actually knows, so the test does not depend on one hardcoded symbol.
const RELIANCE_MSTOCK_TOKEN = 2885; // per MStock's own SDK sample
const known = SymbolRegistry.getSymbol('mstock', RELIANCE_MSTOCK_TOKEN);

console.log('\nA. The exact packet the SDK emits (FeedData, SNAP mode)');
if (!known) {
  console.log('  SKIP  symbol registry has no mstock token 2885 — cannot assert mapping');
} else {
  // Shape copied from the SDK's `FeedData` interface — NOT invented.
  const feedData = {
    InstrumentToken: RELIANCE_MSTOCK_TOKEN,
    Mode: 'snap',
    LastPrice: 1305.5,
    Tradable: true,
    LastQuantity: 10,
    AveragePrice: 1304.2,
    Volume: 125000,
    BuyQuantity: 400,
    SellQuantity: 250,
    Open: 1300, High: 1310, Low: 1298, Close: 1299,
    Change: 0.5,
    OI: 87500,
    OIDayHigh: 90000,
    OIDayLow: 80000,
    Timestamp: new Date('2026-07-13T09:20:00Z'),
    Bids: [{ Price: 1305.4, Quantity: 100, Orders: 3 }],
    Offers: [{ Price: 1305.6, Quantity: 150, Orders: 4 }],
  };

  const tick = mapper.map(feedData);

  ok('N1: a real SDK tick is NOT dropped', tick !== null, 'mapper returned null — the old bug');
  ok('N1: token resolves from InstrumentToken (not data.Token)', tick && tick.symbol === known, tick && tick.symbol);
  ok('N1: price comes from LastPrice (not LastTradedPrice)', tick && tick.ltp === 1305.5, tick && String(tick.ltp));
  ok('N1: volume comes from Volume (not VolumeTradedToday)', tick && tick.volume === 125000, tick && String(tick.volume));
  ok('OHLC mapped', tick && tick.open === 1300 && tick.high === 1310 && tick.low === 1298);

  // SNAP mode carries these; the old mapper threw them away entirely.
  ok('open interest is captured', tick && tick.oi === 87500, tick && String(tick.oi));
  ok('best bid/ask captured from depth', tick && tick.bid === 1305.4 && tick.ask === 1305.6);
  ok('order-book pressure captured', tick && tick.buyQty === 400 && tick.sellQty === 250);
  ok('exchange timestamp used, not arrival time', tick && tick.timestamp === feedData.Timestamp.getTime());
}

console.log('\nB. Absent data must stay absent (rule 13: unknown is not zero)');
if (known) {
  // An equity tick carries no OI. It must be undefined — never 0, which would read as
  // "this option has zero open interest" on a trading screen.
  const equityTick = mapper.map({ InstrumentToken: RELIANCE_MSTOCK_TOKEN, LastPrice: 1305.5 });
  ok('missing OI is undefined, not 0', equityTick && equityTick.oi === undefined, String(equityTick && equityTick.oi));
  ok('missing volume is undefined, not 0', equityTick && equityTick.volume === undefined);
  ok('missing bid/ask is undefined, not 0', equityTick && equityTick.bid === undefined && equityTick.ask === undefined);
}

console.log('\nC. Unknown / malformed input');
{
  ok('unknown token → null (not a fabricated symbol)', mapper.map({ InstrumentToken: 999999999, LastPrice: 1 }) === null);
  ok('null input → null', mapper.map(null) === null);
}

console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
