/**
 * FlatTrade (Pi Connect / Noren) adapter — verified against the official docs.
 * Run:  npm run verify:flattrade
 *
 * Regression guards (all were real defects):
 *   - base URL is /PiConnectAPI/<Endpoint>, not /PiConnectTP/REST/<Endpoint>
 *   - jKey is the LOGIN TOKEN, never the api_key ("Invalid Session Key" otherwise)
 *   - OrderBook/SingleOrdHist return a JSON ARRAY on success; callApi must not treat that
 *     as an error (it checked `stat !== 'Ok'` unconditionally)
 *   - Noren says "REJECT" (not "REJECTED"); un-normalised, a rejected order looks pending
 *     and the fill poll runs to timeout
 *   - ordertag must reach the broker as `remarks`; trgprc only on SL orders
 */
process.env.LOG_LEVEL = 'silent';

const axios = require('axios');
const { FlatTradeOMS, normalizeStatus } = require('../src/oms/flattrade');

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) { pass++; console.log(`  PASS  ${n}`); } else { fail++; console.log(`  FAIL  ${n} ${e}`); } };

const config = {
  flattrade: { userId: 'FT01', accountId: 'FT01', apiKey: 'THE_API_KEY', token: 'THE_JKEY', baseUrl: undefined },
};

/** Capture what the adapter would send, and reply with a scripted payload. */
function stubAxios(reply) {
  const sent = [];
  const original = axios.post;
  axios.post = async (url, body, opts) => {
    sent.push({ url, body, opts });
    const r = typeof reply === 'function' ? reply(url, body) : reply;
    if (r instanceof Error) throw r;
    return { data: r };
  };
  return { sent, restore: () => { axios.post = original; } };
}

const parseJData = (body) => JSON.parse(decodeURIComponent(body.slice(body.indexOf('jData=') + 6, body.indexOf('&jKey='))));
const parseJKey = (body) => body.slice(body.indexOf('&jKey=') + 6);

(async () => {
  console.log('\nA. Wire format & endpoint');
  {
    const { sent, restore } = stubAxios({ stat: 'Ok', norenordno: 'ORD1' });
    const oms = new FlatTradeOMS(config);
    const res = await oms.placeOrder({
      symbol: 'NIFTY26JUL0925000CE', action: 'BUY', quantity: 75, price: 150.75,
      orderType: 'LMT', productType: 'INTRADAY', validity: 'IOC', ordertag: 'SCLP-abc',
    });
    restore();

    const { url, body, opts } = sent[0];
    ok('POSTs to /PiConnectAPI/PlaceOrder', url === 'https://piconnect.flattrade.in/PiConnectAPI/PlaceOrder', url);
    ok('no legacy /REST/ segment', !/\/REST\//.test(url));
    ok('Content-Type: application/json', opts.headers['Content-Type'] === 'application/json');
    ok('jKey is the LOGIN TOKEN', parseJKey(body) === 'THE_JKEY', parseJKey(body));
    ok('jKey is NOT the api_key', parseJKey(body) !== 'THE_API_KEY');
    ok('returns {orderId}', res.orderId === 'ORD1');

    const d = parseJData(body);
    ok('trantype B for BUY', d.trantype === 'B');
    ok('prd I for INTRADAY', d.prd === 'I');
    ok('ret IOC passed through', d.ret === 'IOC');
    ok('ordertag sent as `remarks`', d.remarks === 'SCLP-abc');
    ok('ordersource = API', d.ordersource === 'API');
    ok('no trgprc on a plain LMT order', d.trgprc === undefined);
  }

  console.log('\nB. Stop orders carry a trigger, not a price');
  {
    const { sent, restore } = stubAxios({ stat: 'Ok', norenordno: 'SL1' });
    const oms = new FlatTradeOMS(config);
    await oms.placeOrder({
      symbol: 'X', action: 'SELL', quantity: 75, orderType: 'SL-MKT',
      triggerPrice: 123.6, productType: 'INTRADAY', ordertag: 'SCLP-abc_SL',
    });
    restore();
    const d = parseJData(sent[0].body);
    ok('prctyp SL-MKT', d.prctyp === 'SL-MKT');
    ok('trgprc set', d.trgprc === '123.6');
    ok('prc is 0 for a stop-market', d.prc === '0');
    ok('trantype S for SELL', d.trantype === 'S');
  }

  console.log('\nC. Array responses are success, not errors');
  {
    const { restore } = stubAxios([{ norenordno: 'ORD1', status: 'OPEN' }, { norenordno: 'ORD2', status: 'COMPLETE' }]);
    const oms = new FlatTradeOMS(config);
    const book = await oms.getOrderBook();
    restore();
    ok('OrderBook array returned (old code threw)', Array.isArray(book) && book.length === 2);
  }
  {
    const { restore } = stubAxios({ stat: 'Not_Ok', emsg: 'Session Expired : Invalid Session Key' });
    const oms = new FlatTradeOMS(config);
    let threw = null;
    try { await oms.getOrderBook(); } catch (e) { threw = e; }
    restore();
    ok('object with stat Not_Ok still throws', threw !== null && /Invalid Session Key/.test(threw.message));
  }

  console.log('\nD. Order status normalisation (Noren says "REJECT", not "REJECTED")');
  {
    ok('COMPLETE -> COMPLETE', normalizeStatus('COMPLETE') === 'COMPLETE');
    ok('REJECT -> REJECTED', normalizeStatus('REJECT') === 'REJECTED');
    ok('Open -> OPEN (case-insensitive)', normalizeStatus('Open') === 'OPEN');
    ok('CANCELLED -> CANCELED', normalizeStatus('CANCELLED') === 'CANCELED');
    ok('PENDING -> PENDING', normalizeStatus('PENDING') === 'PENDING');
  }
  {
    // SingleOrdHist: newest first; a terminal state anywhere wins.
    const { restore } = stubAxios([
      { status: 'COMPLETE', fillshares: '75', avgprc: '150.75', norenordno: 'ORD1' },
      { status: 'OPEN', fillshares: '0', avgprc: '0' },
      { status: 'PENDING', fillshares: '0', avgprc: '0' },
    ]);
    const oms = new FlatTradeOMS(config);
    const st = await oms.getOrderStatus('ORD1');
    restore();
    ok('status COMPLETE', st.status === 'COMPLETE');
    ok('filledQty parsed', st.filledQty === 75);
    ok('avgPrice parsed (broker fill price)', Math.abs(st.avgPrice - 150.75) < 1e-9);
  }
  {
    const { restore } = stubAxios([{ status: 'REJECT', rejreason: 'Insufficient funds', fillshares: '0', avgprc: '0' }]);
    const oms = new FlatTradeOMS(config);
    const st = await oms.getOrderStatus('ORD9');
    restore();
    ok('REJECT surfaces as REJECTED (executor aborts instead of polling)', st.status === 'REJECTED');
    ok('reject reason surfaced', /Insufficient funds/.test(st.rejectReason));
  }

  console.log('\nE. Capability + safety contract');
  {
    const oms = new FlatTradeOMS(config);
    ok('supportsRestingStop()', oms.supportsRestingStop() === true);
    ok('getOrderStatus is implemented', typeof oms.getOrderStatus === 'function');
    ok('setAccessToken injects the central session jKey', (oms.setAccessToken('new-jkey'), oms.jKey() === 'new-jkey'));

    const noToken = new FlatTradeOMS({ flattrade: { userId: 'FT01', apiKey: 'k' } });
    let threw = null;
    try { await noToken.connect(); } catch (e) { threw = e; }
    ok('connect() fails closed without a jKey', threw !== null && /jKey/.test(threw.message));
  }
  {
    const oms = new FlatTradeOMS(config);
    ok('productCode INTRADAY -> I', oms.productCode('INTRADAY') === 'I');
    ok('productCode NRML -> M', oms.productCode('NRML') === 'M');
    ok('productCode default -> I (intraday)', oms.productCode(undefined) === 'I');
  }

  console.log(`\n──────────────────────────────\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
