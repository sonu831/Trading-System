const path = require('path');
// Register ts-node for the SDK
require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
  // Ensure we look in the right node_modules if script is nested
  // dir: path.resolve(__dirname, '..') // might be needed
});

const fs = require('fs');
// const path = require('path'); // already imported
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { DateTime } = require('luxon');
const { MStockVendor } = require('../src/vendors/mstock');
// Load master map - works in both local and Docker environments
const vendorPath = path.resolve(__dirname, '..', 'vendor', 'nifty50_shared.json');
const masterMap = require(vendorPath);

// --- Configuration ---
const args = process.argv.slice(2);
const HISTORY_DAYS = parseInt(args.includes('--days') ? args[args.indexOf('--days') + 1] : '5', 10);
const TARGET_SYMBOL = args.includes('--symbol') ? args[args.indexOf('--symbol') + 1] : null;
const SKIP_REDIS = args.includes('--no-redis');
const FROM_DATE = args.includes('--from') ? args[args.indexOf('--from') + 1] : null;
const TO_DATE = args.includes('--to') ? args[args.indexOf('--to') + 1] : null;
const JOB_ID = args.includes('--job-id')
  ? args[args.indexOf('--job-id') + 1]
  : `manual-${Date.now()}`;

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = require('redis');
let redisClient = null;

const INTERVAL = process.env.BACKFILL_INTERVAL || 'ONE_MINUTE';
const BATCH_SIZE = parseInt(process.env.BACKFILL_BATCH_SIZE || '100', 10);
const OUTPUT_DIR = path.resolve(__dirname, '../data/historical');
const BATCH_DELAY_MS = 1000; // 1 second delay between stocks

// Stats tracking
let totalCandles = 0;
let successCount = 0;
let failCount = 0;
const startTime = Date.now();

// Notification helper
async function sendNotification(type, data) {
  if (!redisClient) return;
  try {
    await redisClient.publish(
      'backfill:status',
      JSON.stringify({
        type,
        jobId: JOB_ID,
        ...data,
        timestamp: new Date().toISOString(),
      })
    );
  } catch (e) {
    console.warn('Notification failed:', e.message);
  }
}

async function main() {
  // Determine date range
  let start, end;

  if (FROM_DATE && TO_DATE) {
    // Use explicit date range
    start = DateTime.fromISO(FROM_DATE);
    end = DateTime.fromISO(TO_DATE);
    console.log(`🚀 Starting Backfill (${FROM_DATE} to ${TO_DATE})...`);
  } else {
    // Use HISTORY_DAYS
    end = DateTime.now();
    start = end;
    let daysCount = 0;
    while (daysCount < HISTORY_DAYS) {
      start = start.minus({ days: 1 });
      if (start.weekday <= 5) daysCount++;
    }
    console.log(`🚀 Starting Nifty 50 Batch Ingestion (Last ${HISTORY_DAYS} Working Days)...`);
  }

  if (TARGET_SYMBOL) console.log(`🎯 Targeting Single Symbol: ${TARGET_SYMBOL}`);

  // Filter Map
  const processList = TARGET_SYMBOL
    ? masterMap.filter((s) => s.symbol === TARGET_SYMBOL)
    : masterMap;

  if (processList.length === 0) {
    console.error(`❌ Symbol ${TARGET_SYMBOL} not found in Master Map.`);
    process.exit(1);
  }

  const params = {
    fromdate: start.toISODate(),
    todate: end.toISODate(),
    interval: INTERVAL,
    exchange: 'NSE',
  };

  console.log(`📅 Time Range: ${params.fromdate} to ${params.todate}`);
  console.log(`📁 Output Directory: ${OUTPUT_DIR}`);
  console.log(`📉 Stocks to Process: ${processList.length}`);

  // 2. Initialize Vendor & Redis
  if (!SKIP_REDIS) {
    try {
      console.log(`🔌 Connecting to Redis at: ${REDIS_URL}`);
      redisClient = redis.createClient({ url: REDIS_URL });
      await redisClient.connect();
      console.log('✅ Connected to Redis for status reporting.');
    } catch (e) {
      console.warn('⚠️ Redis not available, skipping status reporting.');
    }
  }

  // Send START notification
  await sendNotification('START', {
    symbols: TARGET_SYMBOL || 'ALL (Nifty 50)',
    fromDate: params.fromdate,
    toDate: params.todate,
    interval: INTERVAL,
  });

  const updateStatus = async (progress, details, status = 'running') => {
    if (redisClient) {
      const statusObj = {
        status: status,
        progress: Math.round(progress),
        details: details,
        job_type: 'historical_backfill',
        timestamp: Date.now(),
      };
      await redisClient.set('system:layer1:backfill', JSON.stringify(statusObj));
    }
  };

  const vendor = new MStockVendor();
  try {
    await vendor.connect();
    console.log('✅ Authenticated with MStock.');
  } catch (e) {
    console.error('❌ Auth Failed:', e.message);
    await sendNotification('ERROR', { error: e.message });
    if (redisClient) await redisClient.quit();
    process.exit(1);
  }

  // 3. Process Logic (using global successCount/failCount)
  for (const item of processList) {
    const symbol = item.symbol;
    const token = item.tokens ? item.tokens.mstock : null;

    if (!token) {
      console.warn(`⚠️ skipping ${symbol} (No MStock Token)`);
      continue;
    }

    console.log(`\n🔄 Processing ${symbol} (Token: ${token})...`);

    // Calculate progress for step 1 (0-50%)
    const currentIdx = processList.indexOf(item);
    const stepProgress = (currentIdx / processList.length) * 50;
    await updateStatus(
      stepProgress,
      `Fetching ${symbol} (${currentIdx + 1}/${processList.length})`
    );

    try {
      const fetchParams = {
        ...params,
        symboltoken: token,
      };

      const response = await vendor.fetchData(fetchParams);

      if (response.status && response.data && Array.isArray(response.data.candles)) {
        const filename = `${symbol}_${INTERVAL}.json`;
        const filePath = path.join(OUTPUT_DIR, filename);

        // Transform candles to User Format ["yyyy-MM-dd HH:mm", O, H, L, C, V]
        const formattedCandles = response.data.candles.map((c) => {
          let timeVal, o, h, l, cl, v;

          if (Array.isArray(c)) {
            [timeVal, o, h, l, cl, v] = c;
          } else {
            timeVal = c.timestamp || c.Date || c.time;
            o = c.open || c.Open;
            h = c.high || c.High;
            l = c.low || c.Low;
            cl = c.close || c.Close;
            v = c.volume || c.Volume;
          }

          // Parse timestamp - handle multiple formats:
          // 1. ISO string with 'T' (e.g., "2026-01-17T09:15:00")
          // 2. Unix seconds (10 digits) e.g., 1737100500
          // 3. Unix milliseconds (13 digits) e.g., 1737100500000
          // 4. Date string (e.g., "2026-01-17 09:15")
          let dt;
          const timeStr = String(timeVal);

          if (timeStr.includes('T')) {
            dt = DateTime.fromISO(timeStr);
          } else if (/^\d{10}$/.test(timeStr)) {
            // Unix seconds (10 digits)
            dt = DateTime.fromSeconds(parseInt(timeStr));
          } else if (/^\d{13}$/.test(timeStr)) {
            // Unix milliseconds (13 digits)
            dt = DateTime.fromMillis(parseInt(timeStr));
          } else if (/^\d{4}-\d{2}-\d{2}/.test(timeStr)) {
            // Date string like "2026-01-17 09:15"
            dt = DateTime.fromFormat(timeStr, 'yyyy-MM-dd HH:mm');
          } else {
            // Fallback: try to parse as number (likely seconds)
            const numVal = parseInt(timeStr);
            if (!isNaN(numVal) && numVal > 1000000000) {
              dt =
                numVal > 10000000000 ? DateTime.fromMillis(numVal) : DateTime.fromSeconds(numVal);
            } else {
              console.warn(`   ⚠️ Unknown time format: ${timeStr}`);
              dt = DateTime.now(); // Fallback
            }
          }

          return [
            dt.toFormat('yyyy-MM-dd HH:mm'),
            parseFloat(o),
            parseFloat(h),
            parseFloat(l),
            parseFloat(cl),
            parseInt(v),
          ];
        });

        const fileData = {
          symbol: symbol,
          token: token,
          interval: INTERVAL,
          range: { from: params.fromdate, to: params.todate },
          fetchedAt: new Date().toISOString(),
          count: formattedCandles.length,
          candles: formattedCandles,
        };

        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
        console.log(`   ✅ Saved ${formattedCandles.length} candles to ${filename}`);
        totalCandles += formattedCandles.length;
        successCount++;
      } else {
        console.error(`   ❌ Failed to fetch data: ${response.message || 'Unknown Error'}`);
        failCount++;
      }
    } catch (e) {
      console.error(`   ❌ Error processing ${symbol}: ${e.message}`);
      failCount++;
    }

    // Rate Limit Delay
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));

    // Send metric to parent if possible
    if (process.send) {
      process.send({
        type: 'metric',
        name: 'externalApiCalls',
        labels: { vendor: 'mstock', endpoint: 'getHistoricalData', status: 'success' },
        value: 1,
      });
    }
  }

  // 4. Cleanup & Summary
  const endTime = Date.now();
  const durationSeconds = ((endTime - startTime) / 1000).toFixed(2);

  console.log('\n==========================================');
  console.log(`🏁 Batch Job Complete.`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed:     ${failCount}`);
  console.log(`📊 Total Candles: ${totalCandles}`);
  console.log(`⏱️  Duration: ${durationSeconds}s`);
  console.log('==========================================');

  await vendor.disconnect();
  await updateStatus(100, 'Backfill Complete', 'completed');

  // Send COMPLETE notification with full stats
  await sendNotification('COMPLETE', {
    symbols: TARGET_SYMBOL || 'ALL (Nifty 50)',
    fromDate: params.fromdate,
    toDate: params.todate,
    successCount,
    failCount,
    totalCandles,
    durationSeconds,
    dbRowsInserted: totalCandles, // Placeholder - will be actual DB count when implemented
  });

  // Legacy notification for existing subscribers
  if (redisClient) {
    const stats = {
      symbol: TARGET_SYMBOL || 'Nifty 50 Batch',
      start_date: params.fromdate,
      end_date: params.todate,
      count: successCount,
      totalCandles,
      duration: durationSeconds,
    };
    await redisClient.publish('notifications:backfill', JSON.stringify(stats));
    await redisClient.quit();
  }
  process.exit(0);
}

main();
