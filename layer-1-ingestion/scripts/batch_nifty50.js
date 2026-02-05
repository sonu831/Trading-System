const path = require('path');
// Register ts-node for the SDK
require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
  compilerOptions: {
    module: "commonjs",
    allowJs: true
  }
});

const fs = require('fs');
// const path = require('path'); // already imported
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
console.log("DEBUG: Script initialized. Loading libs...");

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
const PUSHGATEWAY_URL = process.env.PUSHGATEWAY_URL || 'http://prometheus-pushgateway:9091';
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend-api:4000';
const redis = require('redis');
const axios = require('axios');
let redisClient = null;

// Force refetch flag (skip data availability check)
const FORCE_REFETCH = args.includes('--force');

// Backend API Helper (Layer 7 - Single Source of Truth)
const backendApi = {
  async updateBackfillJob(jobId, params) {
    if (!jobId || jobId.startsWith('manual-')) return; // Skip for manual jobs
    try {
      await axios.patch(`${BACKEND_API_URL}/api/v1/backfill/${jobId}`, params);
    } catch (e) {
      console.warn(`⚠️ Backend API update failed: ${e.message}`);
    }
  },
  async updateDataAvailability(params) {
    try {
      await axios.put(`${BACKEND_API_URL}/api/v1/data/availability`, params);
    } catch (e) {
      console.warn(`⚠️ Data availability update failed: ${e.message}`);
    }
  },
  /**
   * Get data availability for a specific symbol
   * @param {string} symbol - The stock symbol
   * @returns {Object|null} - { first_date, last_date, total_records } or null
   */
  async getDataAvailability(symbol) {
    try {
      const res = await axios.get(`${BACKEND_API_URL}/api/v1/data/availability?symbol=${symbol}`);
      const symbols = res.data?.data?.symbols || [];
      return symbols.length > 0 ? symbols[0] : null;
    } catch (e) {
      console.warn(`⚠️ Data availability check failed: ${e.message}`);
      return null;
    }
  },
};

/**
 * Calculate date ranges that need to be fetched (smart gap detection)
 * @param {string} requestedFrom - Requested start date (YYYY-MM-DD)
 * @param {string} requestedTo - Requested end date (YYYY-MM-DD)
 * @param {Object|null} existing - Existing data availability { first_date, last_date }
 * @returns {Array<{from: string, to: string}>} - Array of date ranges to fetch
 */
function calculateMissingRanges(requestedFrom, requestedTo, existing) {
  if (!existing || !existing.first_date || !existing.last_date) {
    // No existing data - fetch entire range
    return [{ from: requestedFrom, to: requestedTo }];
  }

  const reqFrom = DateTime.fromISO(requestedFrom);
  const reqTo = DateTime.fromISO(requestedTo);
  const existFirst = DateTime.fromISO(existing.first_date.split('T')[0]);
  const existLast = DateTime.fromISO(existing.last_date.split('T')[0]);

  const ranges = [];

  // Check if we need data BEFORE existing range
  if (reqFrom < existFirst) {
    ranges.push({
      from: reqFrom.toISODate(),
      to: existFirst.minus({ days: 1 }).toISODate(),
    });
  }

  // Check if we need data AFTER existing range
  if (reqTo > existLast) {
    ranges.push({
      from: existLast.plus({ days: 1 }).toISODate(),
      to: reqTo.toISODate(),
    });
  }

  return ranges;
}

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

// Prometheus Pushgateway helper
async function pushMetric(name, value, labels = {}) {
  try {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    const metric = `${name}{${labelStr}} ${value}\n`;

    await axios.post(`${PUSHGATEWAY_URL}/metrics/job/backfill_batch`, metric, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 2000,
    });
  } catch (e) {
    // Silently fail - metrics are non-critical
    console.debug('Failed to push metric:', e.message);
  }
}

async function main() {
  // Determine date range
  let start, end;
  const today = DateTime.now().startOf('day');

  if (FROM_DATE && TO_DATE) {
    // Use explicit date range
    start = DateTime.fromISO(FROM_DATE);
    end = DateTime.fromISO(TO_DATE);

    // Cap end date to yesterday to avoid "today" fetch errors during market hours
    // Historical API usually provides closed candles only.
    if (end >= today) {
      const yesterday = today.minus({ days: 1 });
      console.log(`⚠️ End date ${TO_DATE} is today/future. Capping to yesterday (${yesterday.toISODate()}) to ensure data availability.`);
      end = yesterday;
    }

    console.log(`🚀 Starting Backfill (${start.toISODate()} to ${end.toISODate()})...`);
  } else {
    // Use HISTORY_DAYS
    end = today;
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
  const isAll = !TARGET_SYMBOL || TARGET_SYMBOL === '' || TARGET_SYMBOL.toUpperCase() === 'ALL';
  const processList = isAll
    ? masterMap
    : masterMap.filter((s) => s.symbol === TARGET_SYMBOL.toUpperCase());

  if (processList.length === 0) {
    console.error(`❌ Symbol ${TARGET_SYMBOL} not found in Master Map.`);
    process.exit(1);
  }

  const params = {
    fromdate: start.toISODate(),
    todate: end.toISODate(),
    interval: INTERVAL,
    exchange: 'NSE',
    useSwarm: args.includes('--use-swarm') ? args[args.indexOf('--use-swarm') + 1] === 'true' : true, // Default true
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
      redisClient = null;
    }
  }

  // Send START notification
  await sendNotification('START', {
    symbols: TARGET_SYMBOL || 'ALL (Nifty 50)',
    fromDate: params.fromdate,
    toDate: params.todate,
    interval: INTERVAL,
  });

  const logToRedis = async (message) => {
    if (redisClient) {
      try {
        const logEntry = JSON.stringify({
          timestamp: new Date().toISOString(),
          message: message,
        });
        // Push to list and trim to last 50 entries
        await redisClient.lPush('system:layer1:logs', logEntry);
        await redisClient.lTrim('system:layer1:logs', 0, 49);
      } catch (e) {
        console.warn('Failed to push log to Redis', e);
      }
    }
  };

  const updateStatus = async (progress, details, status = 1) => {
    if (redisClient) {
      const statusObj = {
        status: status, // 0:Idle, 1:Run, 2:Done, 3:Fail
        progress: Math.round(progress),
        details: details,
        job_type: 'historical_backfill',
        timestamp: Date.now(),
      };
      await redisClient.set('system:layer1:backfill', JSON.stringify(statusObj));

      // Auto-log details if provided
      if (details) await logToRedis(details);
    }

    // Push metrics to Prometheus
    await pushMetric('batch_job_status', status, { job_type: 'historical_backfill', job_id: JOB_ID });
    await pushMetric('batch_job_progress', Math.round(progress), {
      job_type: 'historical_backfill',
      job_id: JOB_ID,
    });
  };

  const vendor = new MStockVendor({ redisClient: redisClient }); // Pass Redis Client for Swarm
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

    // Calculate progress for step 1 (0-50%)
    const currentIdx = processList.indexOf(item);

    // ═══════════════════════════════════════════════════════════════
    // Smart Data Availability Check (Skip if data already exists)
    // ═══════════════════════════════════════════════════════════════
    let rangesToFetch = [{ from: params.fromdate, to: params.todate }];

    if (!FORCE_REFETCH) {
      const existingData = await backendApi.getDataAvailability(symbol);

      if (existingData) {
        rangesToFetch = calculateMissingRanges(params.fromdate, params.todate, existingData);

        if (rangesToFetch.length === 0) {
          console.log(`\n⏭️  Skipping ${symbol} - Data already exists (${existingData.first_date?.split('T')[0]} to ${existingData.last_date?.split('T')[0]})`);
          successCount++;
          continue;
        }

        console.log(`\n🔄 Processing ${symbol} (Token: ${token}) - Fetching ${rangesToFetch.length} missing range(s)...`);
        rangesToFetch.forEach((r, i) => console.log(`   📅 Range ${i + 1}: ${r.from} to ${r.to}`));
      } else {
        console.log(`\n🔄 Processing ${symbol} (Token: ${token}) - No existing data, fetching full range...`);
      }
    } else {
      console.log(`\n🔄 Processing ${symbol} (Token: ${token}) - Force refetch enabled...`);
    }

    try {
      let allFormattedCandles = [];
      let fetchSuccess = true;

      // Fetch each missing range and accumulate candles
      for (const range of rangesToFetch) {
        const fetchParams = {
          ...params,
          fromdate: range.from,
          todate: range.to,
          symboltoken: token,
          symbol: symbol // For Swarm Dashboard Visibility
        };

        const response = await vendor.fetchData(fetchParams);

        if (response.status && response.data && Array.isArray(response.data.candles)) {
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

            // Parse timestamp - handle multiple formats
            let dt;
            const timeStr = String(timeVal);

            if (timeStr.includes('T')) {
              dt = DateTime.fromISO(timeStr);
            } else if (/^\d{10}$/.test(timeStr)) {
              dt = DateTime.fromSeconds(parseInt(timeStr));
            } else if (/^\d{13}$/.test(timeStr)) {
              dt = DateTime.fromMillis(parseInt(timeStr));
            } else if (/^\d{4}-\d{2}-\d{2}/.test(timeStr)) {
              dt = DateTime.fromFormat(timeStr, 'yyyy-MM-dd HH:mm');
            } else {
              const numVal = parseInt(timeStr);
              if (!isNaN(numVal) && numVal > 1000000000) {
                dt = numVal > 10000000000 ? DateTime.fromMillis(numVal) : DateTime.fromSeconds(numVal);
              } else {
                console.warn(`   ⚠️ Unknown time format: ${timeStr}`);
                dt = DateTime.now();
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

          allFormattedCandles.push(...formattedCandles);
          console.log(`   📥 Fetched ${formattedCandles.length} candles for range ${range.from} to ${range.to}`);
        } else {
          // Fix for "Confusing Error Message" bug
          console.error(`   ❌ Failed to fetch range ${range.from} to ${range.to}`);
          console.error(`      Error: ${response.message || 'Unknown Error'}`);
          if (response.errorcode) console.error(`      Code:  ${response.errorcode}`);
          if (response.details) console.error(`      Detail: ${JSON.stringify(response.details)}`);
          fetchSuccess = false;
        }
      } // End of rangesToFetch loop

      // Save combined data if we got any candles
      if (allFormattedCandles.length > 0) {
        const filename = `${symbol}_${INTERVAL}.json`;
        const filePath = path.join(OUTPUT_DIR, filename);

        // Sort candles by timestamp
        allFormattedCandles.sort((a, b) => a[0].localeCompare(b[0]));

        const fileData = {
          symbol: symbol,
          token: token,
          interval: INTERVAL,
          range: { from: params.fromdate, to: params.todate },
          fetchedAt: new Date().toISOString(),
          count: allFormattedCandles.length,
          candles: allFormattedCandles,
        };

        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2));
        console.log(`   ✅ Saved ${allFormattedCandles.length} candles to ${filename}`);
        await logToRedis(`✅ ${symbol}: Saved ${allFormattedCandles.length} candles`);
        totalCandles += allFormattedCandles.length;
        successCount++;

        // Update Backend API with data availability
        const candleDates = allFormattedCandles.map(c => c[0].split(' ')[0]);
        const firstDate = candleDates.length > 0 ? candleDates[0] : params.fromdate;
        const lastDate = candleDates.length > 0 ? candleDates[candleDates.length - 1] : params.todate;
        await backendApi.updateDataAvailability({
          symbol,
          timeframe: INTERVAL,
          firstDate,
          lastDate,
          recordCount: allFormattedCandles.length,
        });
      } else if (!fetchSuccess) {
        await logToRedis(`❌ ${symbol}: Failed - No data fetched`);
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

    // Update Backend API with job progress
    const progressPercent = Math.round(((currentIdx + 1) / processList.length) * 100);
    await backendApi.updateBackfillJob(JOB_ID, {
      status: 'RUNNING',
      processed: successCount,
      errors: failCount,
    });
    await updateStatus(progressPercent, `Processed ${currentIdx + 1}/${processList.length} symbols`);
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
  await updateStatus(100, 'Backfill Complete', 2);

  // Update Backend API with final job status
  await backendApi.updateBackfillJob(JOB_ID, {
    status: failCount > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED',
    processed: successCount,
    errors: failCount,
  });

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
