/**
 * batch_nifty50.ts — Nifty 50 historical data backfill script.
 * ALL communication goes through the L7 Backend API.
 * Never talks to Redis, Kafka, or TimescaleDB directly.
 *
 * Run: npx tsx scripts/batch_nifty50.ts --symbol RELIANCE --from 2026-07-01 --to 2026-07-11
 */
const path = require('path');

// Register ts-node for the SDK (same as src/index.ts)
try { require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' }, ignore: [/node_modules\/(?!@mstock-mirae-asset)/] }); } catch (_) {}

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { DateTime } = require('luxon');
const axios = require('axios');

const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend-api:4000';
const INTERVAL = process.env.BACKFILL_INTERVAL || 'ONE_MINUTE';

const api = {
  async getSessionToken(p: string) { const r = await axios.get(`${BACKEND_API_URL}/api/v1/providers/${p}/session`, {timeout:5000}); return r.data?.data?.session_token||null; },
  async getDecryptedCredentials(p: string) { const r = await axios.get(`${BACKEND_API_URL}/api/v1/providers/${p}/credentials/decrypted`, {timeout:5000}); return r.data?.data?.credentials||{}; },
  async getDataAvailability(s: string) { const r = await axios.get(`${BACKEND_API_URL}/api/v1/data/availability?symbol=${s}`, {timeout:5000}); return (r.data?.data?.symbols||[])[0]||null; },
  async updateDataAvailability(d: any) { await axios.put(`${BACKEND_API_URL}/api/v1/data/availability`,d,{timeout:5000}).catch(()=>{}); },
  async updateBackfillJob(id: string, d: any) { if(id&&!id.startsWith('manual-')) await axios.patch(`${BACKEND_API_URL}/api/v1/backfill/${id}`,d,{timeout:5000}).catch(()=>{}); },
  async postLog(msg: string, lvl='info', d: any={}) { await axios.post(`${BACKEND_API_URL}/api/v1/system/log`,{level:lvl,message:msg,data:d},{timeout:5000}).catch(()=>{}); },
};

class MStockClient {
  apiKey=''; token=''; client:any;
  async init() {
    console.log('🔑 Loading credentials from Backend API...');
    const creds = await api.getDecryptedCredentials('mstock');
    this.apiKey = creds.api_key || '';
    if (!this.apiKey) throw new Error('No MStock api_key. Configure via Dashboard → Brokers.');
    const { MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb');
    this.client = new MConnect('https://api.mstock.trade', this.apiKey);
    this.token = await api.getSessionToken('mstock');
    if (this.token) { this.client.setAccessToken(this.token); console.log('  ✅ session token via API'); }
  }
  async getHistoricalData(p: any) { return this.client.getHistoricalData(p); }
}

function calculateMissingRanges(rf: string, rt: string, ex: any) {
  if(!ex?.first_date||!ex?.last_date) return [{from:rf,to:rt}];
  const a=DateTime.fromISO(rf),b=DateTime.fromISO(rt),c=DateTime.fromISO(ex.first_date.split('T')[0]),d=DateTime.fromISO(ex.last_date.split('T')[0]);
  const r:any[]=[]; if(a<c) r.push({from:a.toISODate()!,to:c.minus({days:1}).toISODate()!}); if(b>d) r.push({from:d.plus({days:1}).toISODate()!,to:b.toISODate()!});
  return r;
}

async function main() {
  const args = process.argv.slice(2);
  const TARGET = args.includes('--symbol')?args[args.indexOf('--symbol')+1]:null;
  const FROM = args.includes('--from')?args[args.indexOf('--from')+1]:null;
  const TO = args.includes('--to')?args[args.indexOf('--to')+1]:null;
  const JOB_ID = args.includes('--job-id')?args[args.indexOf('--job-id')+1]:`manual-${Date.now()}`;
  const FORCE = args.includes('--force');
  const today = DateTime.now().startOf('day');
  let start = FROM?DateTime.fromISO(FROM):today.minus({days:5});
  let end = TO?DateTime.fromISO(TO):today;
  if(end>=today) end = today.minus({days:1});

  console.log(`🚀 Backfill: ${start.toISODate()} → ${end.toISODate()}`);

  // Load MStock token map (symbols_mstock.json has correct mstock tokens)
  const tokenMap = require(path.resolve(__dirname,'..','config','symbols_mstock.json'));
  const processList = (TARGET&&TARGET!=='ALL') ? tokenMap.filter((s:any)=>s.symbol===TARGET.toUpperCase()) : tokenMap;
  console.log(`📉 ${processList.length} symbols to process`);

  await api.postLog(`Backfill started: ${processList.length} symbols, ${start.toISODate()} → ${end.toISODate()}`);
  await api.updateBackfillJob(JOB_ID, {status:'RUNNING',started_at:new Date().toISOString()});

  const vendor = new MStockClient();
  try { await vendor.init(); } catch(e:any) { console.error('❌',e.message); await api.postLog(e.message,'error'); await api.updateBackfillJob(JOB_ID,{status:'FAILED',errors:[e.message]}); process.exit(1); }

  let total=0, ok=0, fail=0;
  for (const item of processList) {
    const sym = item.symbol, tok = item.mstock_token;
    if (!tok) { console.warn(`⚠️ skip ${sym} (no token)`); continue; }
    const idx = processList.indexOf(item);

    let ranges = [{from:start.toISODate()!,to:end.toISODate()!}];
    if(!FORCE) { const ex = await api.getDataAvailability(sym); if(ex) { ranges = calculateMissingRanges(start.toISODate()!,end.toISODate()!,ex); if(ranges.length===0) { console.log(`⏭️ ${sym} already covered`); ok++; continue; } } }

    try {
      let candles:any[]=[];
      for(const rng of ranges) {
        const data = await vendor.getHistoricalData({exchange:'NSE',symboltoken:tok,interval:INTERVAL,fromdate:rng.from,todate:rng.to});
        if(data?.data?.candles) candles=candles.concat(data.data.candles);
      }
      if(candles.length>0) {
        const {Kafka}=require('kafkajs');
        const k=new Kafka({clientId:'batch-backfill',brokers:(process.env.KAFKA_BROKERS||'kafka:29092').split(',')});
        const p=k.producer();await p.connect();
        for(const c of candles) await p.send({topic:process.env.KAFKA_TOPIC||'raw-ticks',messages:[{value:JSON.stringify({type:'historical_candle',symbol:sym,candle:c})}]});
        await p.disconnect();
        total+=candles.length; ok++;
        const dates = candles.map((c:any)=>c[0]||c.timestamp).sort();
        await api.updateDataAvailability({symbol:sym,timeframe:'1m',firstDate:dates[0],lastDate:dates[dates.length-1],recordCount:candles.length});
        console.log(`  ✅ ${sym}: ${candles.length} candles`);
      }
    } catch(e:any) { console.error(`  ❌ ${sym}: ${e.message}`); fail++; }
  }

  await api.postLog(`Backfill done: ${ok} OK, ${fail} failed, ${total} candles`);
  await api.updateBackfillJob(JOB_ID,{status:'COMPLETED',completed_at:new Date().toISOString(),processed:total,total_records:total,errors:fail>0?[`${fail} symbols failed`]:[]});
  console.log(`\n✅ Done: ${ok} symbols · ${total.toLocaleString()} candles`);
}

main().catch(e=>{console.error('Fatal:',e);process.exit(1)});
