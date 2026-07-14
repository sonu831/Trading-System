/**
 * backfill-runner.ts — Provider-agnostic historical data backfill.
 *
 * Discovers the first enabled data provider from the L7 API,
 * loads credentials/session-token from L7, creates the vendor
 * via VendorRegistry, fetches candles, and streams to Kafka.
 *
 * ADDING A VENDOR = add to vendor-registry.ts only. This script never changes.
 *
 * Run: npx tsx scripts/backfill-runner.ts --symbol RELIANCE --from 2026-07-08 --to 2026-07-10
 *
 * This file is TypeScript and MUST be executed under tsx (`node --import tsx`). It shipped as
 * `backfill-runner.js` for a while: Node parsed the TS syntax as plain JS and every backfill
 * died on `SyntaxError: Unexpected token '?'` before doing any work. Do not rename it back,
 * and do not add a `.js` twin (rule 15).
 */
const path = require('path');

// tsx (the loader running this file) already transpiles any .ts the vendor registry pulls in —
// ts-node is banned by rule 15 and was only here to paper over the wrong file extension.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const axios = require('axios');

// L7 is default-deny. This is a FORKED process — it never runs src/index.ts, so it does not
// inherit the global axios interceptor and must attach the service key itself.
require('../src/utils/internal-auth').attachInternalAuth(axios);
const { DateTime } = require('luxon');

const API = process.env.BACKEND_API_URL || 'http://backend-api:4000';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',');

const args = process.argv.slice(2);
const TARGET = args.includes('--symbol') ? args[args.indexOf('--symbol') + 1] : null;
const FROM = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const TO = args.includes('--to') ? args[args.indexOf('--to') + 1] : null;
const JOB_ID = args.includes('--job-id') ? args[args.indexOf('--job-id') + 1] : `bak-${Date.now()}`;
const PROVIDER = args.includes('--provider') ? args[args.indexOf('--provider') + 1] : null;

// ═══════════ PROVIDER DISCOVERY + CREDENTIALS ═══════════
async function loadProvider(providerName?: string, masterMap?: any[]) {
  console.log(`🔍 Discovering enabled data providers...`);
  const { data: providersResp } = await axios.get(`${API}/api/v1/providers`, { timeout: 5000 });
  const providers = (providersResp.data || []).filter((p: any) => p.enabled && (p.role === 'data' || p.role === 'both'));

  if (providers.length === 0) throw new Error('No enabled data providers found. Configure via Dashboard → Brokers.');

  // Pick provider with actual instrument tokens, not the first one blindly
  let name = providerName;
  if (!name && masterMap) {
    for (const p of providers) {
      const tf = { mstock: 'mstock', flattrade: 'flattrade', kite: 'kite', indianapi: 'indianapi' }[p.provider];
      const hasTokens = masterMap.some((i: any) => i.tokens?.[tf]);
      if (hasTokens) { name = p.provider; break; }
    }
  }
  if (!name) name = providers[0]?.provider;

  const provider = providers.find((p: any) => p.provider === name);
  if (!provider) throw new Error(`Provider "${name}" not found or not enabled`);

  console.log(`  ✅ Using: ${provider.provider} (${provider.role})`);

  // Fetch session token + decrypted credentials from L7
  const [sessResp, credResp] = await Promise.all([
    axios.get(`${API}/api/v1/providers/${name}/session`, { timeout: 5000 }).catch(() => ({ data: { data: {} } })),
    axios.get(`${API}/api/v1/providers/${name}/credentials/decrypted`, { timeout: 5000 }).catch(() => ({ data: { data: { credentials: {} } } })),
  ]);

  return {
    name,
    credentials: credResp.data?.data?.credentials || {},
    sessionToken: sessResp.data?.data?.session_token || null,
  };
}

// ═══════════ INSTRUMENT TOKEN MAP ═══════════
function loadTokenMap() {
  // Try repository-root vendor/ first, then L1-local config
  try { return require(path.resolve(__dirname, '..', '..', 'vendor', 'nifty50_shared.json')); }
  catch { /* fallback */ }
  try { return require(path.resolve(__dirname, '..', 'vendor', 'nifty50_shared.json')); }
  catch { /* fallback */ }
  // Flat MStock token map
  return require(path.resolve(__dirname, '..', 'config', 'symbols_mstock.json'));
}

// ═══════════ MAIN ═══════════
async function main() {
  console.log(`🚀 Backfill: ${TARGET || 'ALL'} ${FROM} → ${TO}`);

  // Load token map FIRST so we can pick a provider with actual tokens
  console.log('📋 Loading instrument token map...');
  const masterMap = loadTokenMap();

  const provider = await loadProvider(PROVIDER, masterMap);
  const tokenField = { mstock: 'mstock', flattrade: 'flattrade', kite: 'kite', indianapi: 'indianapi' }[provider.name] || 'mstock';

  // 1. Token map — already loaded above, now filter
  const items = masterMap
    .filter((i: any) => i.tokens?.[tokenField] || i[`${tokenField}_token`])
    .map((i: any) => ({
      symbol: i.symbol,
      token: i.tokens?.[tokenField] || i[`${tokenField}_token`],
    }));

  const processList = TARGET && TARGET !== 'ALL'
    ? items.filter((i: any) => i.symbol === TARGET.toUpperCase())
    : items;

  console.log(`  📉 ${processList.length} symbols (${tokenField} tokens)`);
  if (processList.length === 0) throw new Error('No symbols with tokens for this provider');

  // 2. Create vendor through registry
  const { resolveVendor, VENDOR_REGISTRY } = require('../src/vendors/vendor-registry');
  const vendor = resolveVendor(provider.name, {
    apiKey: provider.credentials.api_key,
    sessionToken: provider.sessionToken,
    symbols: [],
  });

  // Set the session token if available
  if (provider.sessionToken && typeof vendor.setAccessToken === 'function') {
    vendor.setAccessToken(provider.sessionToken);
  }

  // 3. Connect vendor (creates MConnect client, sets auth, etc.)
  // For REST-only backfill, skip WebSocket connect but ensure API client is ready
  if (vendor.client) {
    console.log('  ✅ Vendor client ready (REST API mode)');
  } else {
    console.log('  ⚠️ No REST client — vendor may be WS-only');
  }

  // 4. Connect Kafka
  const { Kafka } = require('kafkajs');
  const kafka = new Kafka({ clientId: 'backfill-runner', brokers: KAFKA_BROKERS });
  const producer = kafka.producer();
  await producer.connect();
  console.log('  ✅ Kafka connected');

  // 5. Fetch + stream each symbol
  let total = 0;
  for (const item of processList) {
    try {
      // Use vendor's own fetchData method (works for any registered vendor)
      // For vendors without fetchData, attempt direct client call
      let candles: any[] = [];

      // Every vendor exposes fetchData(). MStock used to be routed around it, straight into the
      // SDK's getHistoricalData() — which omits the mandatory `X-Mirae-Version` header and made
      // the broker answer 401 on every candle request. The quirk now lives in the MStock adapter
      // where it belongs, so the runner stays vendor-agnostic (rule 14).
      if (typeof vendor.fetchData === 'function') {
        const resp = await vendor.fetchData({
          exchange: 'NSE', symboltoken: String(item.token), interval: 'ONE_MINUTE',
          fromdate: `${FROM} 09:15`, todate: `${TO} 15:30`,
        });
        candles = resp?.data?.candles || [];
      } else {
        console.log(`  ⚠️ ${item.symbol}: vendor has no fetchData`);
        continue;
      }

      if (candles.length === 0) { console.log(`  ⚠️ ${item.symbol}: 0 candles`); continue; }

      // Stream to Kafka
      for (const c of candles) {
        await producer.send({
          topic: process.env.KAFKA_TOPIC || 'raw-ticks',
          messages: [{ value: JSON.stringify({ type: 'historical_candle', symbol: item.symbol, candle: c }) }],
        });
      }
      total += candles.length;
      console.log(`  ✅ ${item.symbol}: ${candles.length} candles`);

      // Update data_availability via L7 API
      const dates = candles.map((c: any) => (Array.isArray(c) ? c[0] : c)).sort();
      await axios.put(`${API}/api/v1/data/availability`, {
        symbol: item.symbol, timeframe: '1m',
        firstDate: String(dates[0]).split(' ')[0],
        lastDate: String(dates[dates.length - 1]).split(' ')[0],
        recordCount: candles.length,
      }, { timeout: 5000 }).catch(() => {});

      // Update job progress
      if (!JOB_ID.startsWith('manual'))
        await axios.patch(`${API}/api/v1/backfill/${JOB_ID}`,
          { processed: total, total_records: total }, { timeout: 5000 }).catch(() => {});

    } catch (e: any) {
      console.log(`  ❌ ${item.symbol}: ${e.message?.substring(0, 100) || e}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  await producer.disconnect();
  console.log(`\n✅ Done: ${total.toLocaleString()} candles via ${provider.name}`);
  process.exit(0);
}

main().catch(e => { console.error('Fatal:', e.message || e); process.exit(1); });
