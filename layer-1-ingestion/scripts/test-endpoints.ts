// Test: what MStock endpoints work with this token?
const { MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb');
const axios = require('axios');
require('dotenv').config();
require('../src/utils/internal-auth').attachInternalAuth(axios);

(async () => {
  const API = 'http://backend-api:4000';
  const s = await axios.get(API + '/api/v1/providers/mstock/session');
  const t = s.data.data.session_token;
  const c = await axios.get(API + '/api/v1/providers/mstock/credentials/decrypted');
  const ak = c.data.data.credentials.api_key;
  const cl = new MConnect('https://api.mstock.trade', ak);
  cl.setAccessToken(t);

  const test = async (name, fn) => {
    try { const r = await fn(cl); console.log(`OK ${name}:`, JSON.stringify(r).substring(0, 100)); }
    catch (e) { console.log(`FAIL ${name}:`, e.message?.substring(0, 80)); }
  };

  await test('profile', c => c.profile());
  await test('positions', c => c.getPositions());
  await test('funds', c => c.getFundsSummary());
  await test('orders', c => c.getOrders());
  // Quote via SDK
  await test('quote', c => c.getQuote({ mode: 'LTP', exchangeTokens: { NSE: ['2885'] } }));
  // Historical — test different intervals
  await test('hist 5m', c => c.getHistoricalData({ exchange: 'NSE', symboltoken: '2885', interval: 'FIVE_MINUTE', fromdate: '2026-07-13 09:15', todate: '2026-07-13 10:00' }));
  await test('hist 1h', c => c.getHistoricalData({ exchange: 'NSE', symboltoken: '2885', interval: 'SIXTY_MINUTE', fromdate: '2026-07-10', todate: '2026-07-13' }));
  await test('hist day', c => c.getHistoricalData({ exchange: 'NSE', symboltoken: '2885', interval: 'ONE_DAY', fromdate: '2026-06-01', todate: '2026-07-13' }));
})();
