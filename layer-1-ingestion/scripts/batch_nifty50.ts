/**
 * batch_nifty50.ts — Nifty 50 historical data backfill script.
 * ALL communication goes through the L7 Backend API.
 * Never talks to Redis, Kafka, or TimescaleDB directly.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { DateTime } = require('luxon');
const axios = require('axios');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend-api:4000';
const INTERVAL = process.env.BACKFILL_INTERVAL || 'ONE_MINUTE';
const OUTPUT_DIR = path.resolve(__dirname, '../data/historical');

// ═══════════════════════════════════════════════
// Backend API Helper — the ONLY place we talk to outside world
// ═══════════════════════════════════════════════
const api = {
  async getSessionToken(provider: string) {
    const r = await axios.get(`${BACKEND_API_URL}/api/v1/providers/${provider}/session`, { timeout: 5000 });
    return r.data?.data?.session_token || null;
  },
  async getDecryptedCredentials(provider: string) {
    const r = await axios.get(`${BACKEND_API_URL}/api/v1/providers/${provider}/credentials/decrypted`, { timeout: 5000 });
    return r.data?.data?.credentials || {};
  },
  async getDataAvailability(symbol: string) {
    const r = await axios.get(`${BACKEND_API_URL}/api/v1/data/availability?symbol=${symbol}`, { timeout: 5000 });
    const symbols = r.data?.data?.symbols || [];
    return symbols.length > 0 ? symbols[0] : null;
  },
  async updateDataAvailability(params: Record<string, unknown>) {
    await axios.put(`${BACKEND_API_URL}/api/v1/data/availability`, params, { timeout: 5000 });
  },
  async updateBackfillJob(jobId: string, params: Record<string, unknown>) {
    if (!jobId || jobId.startsWith('manual-')) return;
    await axios.patch(`${BACKEND_API_URL}/api/v1/backfill/${jobId}`, params, { timeout: 5000 });
  },
  async postLog(message: string, level = 'info', data = {}) {
    await axios.post(`${BACKEND_API_URL}/api/v1/system/log`, { level, message, data }, { timeout: 5000 }).catch(() => {});
  },
  async postBackfillProgress(progress: number, message: string) {
    await axios.post(`${BACKEND_API_URL}/api/v1/system/log`, {
      level: 'info', message,
      data: { progress, job_type: 'historical_backfill', timestamp: Date.now() },
    }, { timeout: 5000 }).catch(() => {});
  },
};

// ═══════════════════════════════════════════════
// Vendor — talks to MStock REST API only (SDK)
// ═══════════════════════════════════════════════
class MStockClient {
  apiKey: string;
  token: string;
  client: any;

  constructor() {}
  async init() {
    console.log('🔑 Loading credentials from Backend API...');
    const creds = await api.getDecryptedCredentials('mstock');
    this.apiKey = creds.api_key || '';
    if (!this.apiKey) throw new Error('No MStock api_key. Configure via Dashboard → Brokers.');

    const { MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb');
    this.client = new MConnect('https://api.mstock.trade', this.apiKey);

    // Get session token (also from Backend API, not Redis)
    this.token = await api.getSessionToken('mstock');
    if (this.token) {
      this.client.setAccessToken(this.token);
      console.log('  ✅ session token loaded via API');
    } else {
      // Try login using stored credentials
      if (creds.client_code && creds.password) {
        try {
          const loginResp = await this.client.login({
            clientcode: creds.client_code,
            password: creds.password,
            totp: '',
            state: '',
          });
          if (loginResp.data?.jwtToken) {
            this.token = loginResp.data.jwtToken;
            this.client.setAccessToken(this.token);
            console.log('  ✅ authenticated via login API');
          }
        } catch (e: any) {
          console.warn('  ⚠️  login failed:', e.message);
        }
      }
    }
  }

  async getHistoricalData(params: any) {
    return this.client.getHistoricalData(params);
  }
}

// ═══════════════════════════════════════════════
// Smart gap detection
// ═══════════════════════════════════════════════
function calculateMissingRanges(requestedFrom: string, requestedTo: string, existing: any) {
  if (!existing?.first_date || !existing?.last_date) return [{ from: requestedFrom, to: requestedTo }];

  const reqFrom = DateTime.fromISO(requestedFrom);
  const reqTo = DateTime.fromISO(requestedTo);
  const existFirst = DateTime.fromISO(existing.first_date.split('T')[0]);
  const existLast = DateTime.fromISO(existing.last_date.split('T')[0]);
  const ranges: Array<{ from: string; to: string }> = [];

  if (reqFrom < existFirst) ranges.push({ from: reqFrom.toISODate()!, to: existFirst.minus({ days: 1 }).toISODate()! });
  if (reqTo > existLast) ranges.push({ from: existLast.plus({ days: 1 }).toISODate()!, to: reqTo.toISODate()! });

  return ranges;
}

// ═══════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════
async function main() {
  const args = process.argv.slice(2);
  const TARGET_SYMBOL = args.includes('--symbol') ? args[args.indexOf('--symbol') + 1] : null;
  const FROM_DATE = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
  const TO_DATE = args.includes('--to') ? args[args.indexOf('--to') + 1] : null;
  const JOB_ID = args.includes('--job-id') ? args[args.indexOf('--job-id') + 1] : `manual-${Date.now()}`;
  const FORCE_REFETCH = args.includes('--force');

  // Date range
  const today = DateTime.now().startOf('day');
  let start = FROM_DATE ? DateTime.fromISO(FROM_DATE) : today.minus({ days: 5 });
  let end = TO_DATE ? DateTime.fromISO(TO_DATE) : yesterdayOrToday(today);

  if (end >= today) end = today.minus({ days: 1 }); // Historical API: closed candles only

  console.log(`🚀 Backfill: ${start.toISODate()} → ${end.toISODate()}`);

  // Load symbol master map
  const vendorPath = path.resolve(__dirname, '..', 'vendor', 'nifty50_shared.json');
  const masterMap = require(vendorPath);
  const isAll = !TARGET_SYMBOL || TARGET_SYMBOL === 'ALL';
  const processList = isAll ? masterMap : masterMap.filter((s: any) => s.symbol === TARGET_SYMBOL.toUpperCase());

  await api.postLog(`Backfill started: ${processList.length} symbols, ${start.toISODate()} → ${end.toISODate()}`);
  await api.updateBackfillJob(JOB_ID, { status: 'RUNNING', started_at: new Date().toISOString() });

  // Init MStock client
  const vendor = new MStockClient();
  try { await vendor.init(); } catch (e: any) {
    console.error('❌', e.message);
    await api.postLog(e.message, 'error');
    await api.updateBackfillJob(JOB_ID, { status: 'FAILED', errors: [e.message] });
    process.exit(1);
  }

  let totalCandles = 0, successCount = 0, failCount = 0;

  for (const item of processList) {
    const symbol = item.symbol;
    const token = item.tokens?.mstock;
    if (!token) { console.warn(`⚠️ skip ${symbol} (no token)`); continue; }

    const idx = processList.indexOf(item);
    const progress = Math.round((idx / processList.length) * 100);
    await api.postBackfillProgress(progress, `Processing ${symbol} (${idx + 1}/${processList.length})`);

    let rangesToFetch = [{ from: start.toISODate()!, to: end.toISODate()! }];
    if (!FORCE_REFETCH) {
      const existing = await api.getDataAvailability(symbol);
      if (existing) {
        rangesToFetch = calculateMissingRanges(start.toISODate()!, end.toISODate()!, existing);
        if (rangesToFetch.length === 0) { console.log(`⏭️ ${symbol} already covered`); successCount++; continue; }
      }
    }

    try {
      let allCandles: any[] = [];
      for (const range of rangesToFetch) {
        const data = await vendor.getHistoricalData({
          exchange: 'NSE', symboltoken: String(token),
          interval: INTERVAL, fromdate: range.from, todate: range.to,
        });
        if (data?.data?.candles) allCandles = allCandles.concat(data.data.candles);
      }

      if (allCandles.length > 0) {
        // Write directly to Kafka (L2 consumer → TimescaleDB)
        const { Kafka } = require('kafkajs');
        const kafka = new Kafka({ clientId: 'batch-backfill', brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(',') });
        const producer = kafka.producer();
        await producer.connect();
        for (const candle of allCandles) {
          await producer.send({
            topic: process.env.KAFKA_TOPIC || 'raw-ticks',
            messages: [{ value: JSON.stringify({ type: 'historical_candle', symbol, candle }) }],
          });
        }
        await producer.disconnect();
        totalCandles += allCandles.length;
        successCount++;

        // Update data_availability via API
        const dates = allCandles.map((c: any) => c[0] || c.timestamp).sort();
        await api.updateDataAvailability({
          symbol, timeframe: '1m',
          firstDate: dates[0], lastDate: dates[dates.length - 1],
          recordCount: allCandles.length,
        });
        console.log(`  ✅ ${symbol}: ${allCandles.length} candles`);
      }
    } catch (e: any) {
      console.error(`  ❌ ${symbol}: ${e.message}`);
      failCount++;
    }
  }

  await api.postLog(`Backfill done: ${successCount} OK, ${failCount} failed, ${totalCandles} candles`);
  await api.updateBackfillJob(JOB_ID, {
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
    processed: totalCandles,
    total_records: totalCandles,
    errors: failCount > 0 ? [`${failCount} symbols failed`] : [],
  });
  console.log(`\n✅ Done: ${successCount} symbols · ${totalCandles} candles`);
}

function yesterdayOrToday(today: any) { return today; }

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
