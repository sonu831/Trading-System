/**
 * Phase 0: PROBE the MStock lookback wall using the SDK (not raw HTTP).
 *
 * Raw HTTP calls to /openapi/typeb/instruments/historical return 401 despite a valid
 * session token. The SDK's getHistoricalData() works — the SDK adds Accept headers and
 * handles the base URL differently. Use the SDK, not raw axios.
 *
 * Run: npx tsx scripts/probe-lookback.ts
 */
const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('../src/utils/internal-auth').attachInternalAuth(axios);

const { MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb');

const API = process.env.BACKEND_API_URL || 'http://backend-api:4000';
const PROBE_SYMBOL = 'RELIANCE';
const PROBE_TOKEN = '2885';

const CHECKPOINTS = [
  { label: 'today',      daysBack: 0 },
  { label: '7d',         daysBack: 7 },
  { label: '30d',        daysBack: 30 },
  { label: '60d',        daysBack: 60 },
  { label: '90d',        daysBack: 90 },
  { label: '6mo',        daysBack: 180 },
  { label: '1y',         daysBack: 365 },
  { label: '2y',         daysBack: 730 },
  { label: '3y',         daysBack: 1095 },
  { label: '5y',         daysBack: 1825 },
];

async function main() {
  console.log(`Probing MStock 1-minute lookback wall (SDK)...\n`);
  console.log(`   Symbol: ${PROBE_SYMBOL} (token: ${PROBE_TOKEN})\n`);

  // 1. Get session token + credentials from L7
  console.log('Fetching MStock session...');
  const [sessRes, credRes] = await Promise.all([
    axios.get(`${API}/api/v1/providers/mstock/session`, { timeout: 5000 }),
    axios.get(`${API}/api/v1/providers/mstock/credentials/decrypted`, { timeout: 5000 }),
  ]);
  const token = sessRes.data?.data?.session_token;
  const apiKey = credRes.data?.data?.credentials?.api_key;
  if (!token) throw new Error('No MStock session token');
  if (!apiKey) throw new Error('No MStock API key');

  const client = new MConnect('https://api.mstock.trade', apiKey);
  client.setAccessToken(token);

  // Verify the connection works first
  try {
    const p = await client.profile();
    if (p?.data?.clientcode) console.log(`   Profile: ${p.data.clientcode}\n`);
  } catch (e: any) {
    console.error('   Profile check failed:', e.message);
  }

  // 2. Probe each checkpoint via SDK
  const results: Array<{ daysBack: number; label: string; date: string; candles: number }> = [];

  for (const cp of CHECKPOINTS) {
    const from = new Date(Date.now() - cp.daysBack * 86400000);
    const fromDate = from.toISOString().split('T')[0] + ' 09:15';
    const toDate = from.toISOString().split('T')[0] + ' 15:30';

    try {
      const resp = await client.getHistoricalData({
        exchange: 'NSE',
        symboltoken: PROBE_TOKEN,
        interval: 'ONE_MINUTE',
        fromdate: fromDate,
        todate: toDate,
      });

      const candles = resp?.data || [];
      const count = Array.isArray(candles) ? candles.length : 0;
      const status = count > 0 ? 'OK' : count === 0 ? 'EMPTY' : 'ERR';
      console.log(`   ${status} ${cp.label.padEnd(8)} ${from.toISOString().split('T')[0]} → ${count} candles`);
      results.push({ daysBack: cp.daysBack, label: cp.label, date: from.toISOString().split('T')[0], candles: count });
    } catch (err: any) {
      const msg = err.message?.substring(0, 60) || 'unknown';
      console.log(`   ERR ${cp.label.padEnd(8)} ${from.toISOString().split('T')[0]} → ${msg}`);
      results.push({ daysBack: cp.daysBack, label: cp.label, date: from.toISOString().split('T')[0], candles: -1 });
    }

    await new Promise(r => setTimeout(r, 500)); // rate-limit
  }

  // 3. Report
  const withData = results.filter(r => r.candles > 0);
  const wall = withData.length > 0 ? withData[withData.length - 1] : null;

  console.log(`\nRESULTS:`);
  console.log(`   Earliest with data: ${withData[0]?.date || 'NONE'}`);
  console.log(`   Furthest back:      ${wall ? `${wall.label} (${wall.date}, ${wall.candles} candles)` : 'NO DATA'}`);

  if (withData.length === 0) {
    console.log('\n   All checkpoints returned 0 candles or errors.');
    console.log('   MStock may not serve 1-minute historical data, or the lookback is < 1 day.');
    console.log('   Try probing with interval: FIVE_MINUTE or ONE_DAY.');
  }
}

main().catch(e => { console.error(`\n${e.message}`); process.exit(1); });
