/**
 * Discover MStock instrument tokens for NIFTY 50, BANKNIFTY, and INDIAVIX.
 *
 * Calls MStock's getInstrumentMaster API (returns every tradable instrument)
 * and searches for Nifty 50 constituents + index symbols by name match.
 * Writes results to vendor/nifty50_shared.json.
 *
 * Prerequisites:
 *   1. MStock credentials saved via Dashboard → Brokers → mstock
 *   2. Active session token (Test Connection first)
 *
 * Usage: npx tsx scripts/discover-mstock-tokens.ts
 */
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const API = process.env.BACKEND_API_URL || 'http://localhost:4000';
const VENDOR_MAP_PATH = path.resolve(__dirname, '..', 'vendor', 'nifty50_shared.json');

const NIFTY50_SYMBOLS = [
  'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'SBIN', 'BHARTIARTL',
  'KOTAKBANK', 'ITC', 'LT', 'AXISBANK', 'BAJFINANCE', 'ASIANPAINT', 'MARUTI', 'HCLTECH',
  'TITAN', 'WIPRO', 'SUNPHARMA', 'ULTRACEMCO', 'ONGC', 'NTPC', 'POWERGRID', 'TATAMOTORS',
  'M&M', 'BAJAJFINSV', 'ADANIPORTS', 'COALINDIA', 'TATASTEEL', 'TECHM', 'JSWSTEEL',
  'INDUSINDBK', 'HINDALCO', 'DRREDDY', 'DIVISLAB', 'CIPLA', 'GRASIM', 'BRITANNIA',
  'NESTLEIND', 'EICHERMOT', 'APOLLOHOSP', 'BPCL', 'HEROMOTOCO', 'SBILIFE', 'HDFCLIFE',
  'BAJAJAUTO', 'TATACONSUM', 'ADANIENT', 'LTIM', 'SHRIRAMFIN',
];

const INDEX_SYMBOLS = [
  { symbol: 'NIFTY', names: ['NIFTY 50', 'NIFTY', 'Nifty 50'] },
  { symbol: 'BANKNIFTY', names: ['NIFTY BANK', 'BANKNIFTY', 'Nifty Bank'] },
  { symbol: 'INDIAVIX', names: ['INDIA VIX', 'VIX', 'India VIX'] },
];

interface Instrument {
  exchange: string;
  symboltoken: string;
  tradingsymbol: string;
  name: string;
  instrumenttype?: string;
  expiry?: string;
  strike?: string;
  lotsize?: string;
  tick_size?: string;
}

interface TokenMapEntry {
  symbol: string;
  exchange: string;
  sector: string;
  isIndex?: boolean;
  tokens: { kite?: string; mstock?: string };
}

async function main() {
  console.log('🔍 Discovering MStock instrument tokens...\n');

  // 1. Get MStock session token + credentials from L7
  console.log('Fetching MStock session from L7...');
  const [sessRes, credRes] = await Promise.all([
    axios.get(`${API}/api/v1/providers/mstock/session`, { timeout: 5000 }),
    axios.get(`${API}/api/v1/providers/mstock/credentials/decrypted`, { timeout: 5000 }),
  ]);

  const sessionToken = sessRes.data?.data?.session_token;
  const apiKey = credRes.data?.data?.credentials?.api_key;

  if (!sessionToken) throw new Error('No MStock session token. Run Test Connection in Dashboard → Brokers first.');
  if (!apiKey) throw new Error('No MStock API key. Configure in Dashboard → Brokers.');

  console.log('  ✅ Session active\n');

  // 2. Fetch instrument master from MStock
  console.log('Fetching instrument master from MStock...');
  const resp = await axios.post(
    'https://api.mstock.trade/openapi/typeb/instruments/master',
    { exchange: 'NSE' },
    {
      headers: {
        'X-PrivateKey': apiKey,
        Authorization: `Bearer ${sessionToken}`,
        'X-Mirae-Version': '1',
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    },
  );

  const instruments: Instrument[] = resp.data?.data || [];
  if (instruments.length === 0) throw new Error('Instrument master returned empty');
  console.log(`  ✅ Loaded ${instruments.length.toLocaleString()} instruments\n`);

  // 3. Load existing token map
  let map: TokenMapEntry[] = [];
  try { map = JSON.parse(fs.readFileSync(VENDOR_MAP_PATH, 'utf8')); } catch (_) { map = []; }

  // 4. Search for Nifty 50 constituents
  console.log('🔍 Searching Nifty 50 constituents...');
  let found = 0;
  const nseInstruments = instruments.filter(i => i.exchange === 'NSE' || i.exchange === 'NFO');

  for (const sym of NIFTY50_SYMBOLS) {
    const match = nseInstruments.find(
      (i: Instrument) =>
        i.tradingsymbol?.toUpperCase() === `${sym}-EQ` ||
        i.tradingsymbol?.toUpperCase() === sym ||
        i.name?.toUpperCase().includes(sym),
    );

    if (match) {
      const existing = map.find((e: TokenMapEntry) => e.symbol === sym);
      if (existing) {
        existing.tokens.mstock = match.symboltoken;
      } else {
        map.push({
          symbol: sym,
          exchange: 'NSE',
          sector: '',
          tokens: { mstock: match.symboltoken },
        });
      }
      console.log(`  ✅ ${sym} → ${match.symboltoken} (${match.tradingsymbol})`);
      found++;
    } else {
      console.log(`  ⚠️ ${sym} — NOT FOUND in instrument master`);
    }
  }

  // 5. Search for indices
  console.log(`\n🔍 Searching indices...`);
  for (const idx of INDEX_SYMBOLS) {
    const match = nseInstruments.find((i: Instrument) =>
      idx.names.some(
        (n: string) =>
          i.tradingsymbol?.toUpperCase().includes(n.toUpperCase()) ||
          i.name?.toUpperCase().includes(n.toUpperCase()),
      ),
    );

    if (match) {
      const existing = map.find((e: TokenMapEntry) => e.symbol === idx.symbol);
      if (existing) {
        existing.tokens.mstock = match.symboltoken;
      } else {
        map.push({
          symbol: idx.symbol,
          exchange: 'NSE',
          sector: idx.symbol === 'INDIAVIX' ? 'Volatility' : 'Index',
          isIndex: true,
          tokens: { mstock: match.symboltoken },
        });
      }
      console.log(`  ✅ ${idx.symbol} → ${match.symboltoken} (${match.name || match.tradingsymbol})`);
    } else {
      console.log(`  ❌ ${idx.symbol} — NOT FOUND in instrument master`);
    }
  }

  // 6. Write results
  const sorted = map.sort((a, b) => {
    if (a.isIndex && !b.isIndex) return 1;
    if (!a.isIndex && b.isIndex) return -1;
    return a.symbol.localeCompare(b.symbol);
  });

  fs.writeFileSync(VENDOR_MAP_PATH, JSON.stringify(sorted, null, 2));
  console.log(`\n✅ Written ${sorted.length} entries to ${VENDOR_MAP_PATH}`);
  console.log(`   Nifty 50 matches: ${found}/${NIFTY50_SYMBOLS.length}`);
}

main().catch(e => {
  console.error(`\n❌ ${e.message}`);
  process.exit(1);
});
