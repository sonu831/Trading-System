/**
 * Layer 1 Ingestion: Streaming Backfill with Parallel Workers
 *
 * Features:
 * - Parallel processing (configurable workers)
 * - Direct Kafka streaming (no intermediate JSON files)
 * - Resume capability (tracks progress in Redis)
 * - Smart data availability checking (skip existing data)
 * - Backpressure handling
 *
 * Usage:
 *   node batch_streaming.js [options]
 *
 * Options:
 *   --workers N       Number of parallel workers (default: 3)
 *   --from YYYY-MM-DD Start date
 *   --to YYYY-MM-DD   End date
 *   --days N          Days of history (default: 5, ignored if --from/--to set)
 *   --symbol SYMBOL   Process single symbol only
 *   --force           Force refetch (ignore data availability)
 *   --resume          Resume from last checkpoint
 *   --job-id ID       Job ID for tracking
 *
 * @author Trading System
 */

const path = require('path');
require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
  compilerOptions: { module: 'commonjs', allowJs: true },
});

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { DateTime } = require('luxon');
const { Kafka } = require('kafkajs');
const redis = require('redis');
const axios = require('axios');
const { MStockVendor } = require('../src/vendors/mstock');

// Load master symbol map
const vendorPath = path.resolve(__dirname, '..', 'vendor', 'nifty50_shared.json');
const masterMap = require(vendorPath);

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const getArg = (flag, defaultVal) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const CONFIG = {
  // Workers
  WORKERS: parseInt(getArg('--workers', '3'), 10),

  // Date range
  HISTORY_DAYS: parseInt(getArg('--days', '5'), 10),
  FROM_DATE: getArg('--from', null),
  TO_DATE: getArg('--to', null),

  // Filters
  TARGET_SYMBOL: getArg('--symbol', null),
  FORCE_REFETCH: args.includes('--force'),
  RESUME: args.includes('--resume'),

  // Job tracking
  JOB_ID: getArg('--job-id', `stream-${Date.now()}`),

  // Infrastructure
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  KAFKA_TOPIC: process.env.KAFKA_TOPIC_RAW_TICKS || 'raw-ticks',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  BACKEND_API_URL: process.env.BACKEND_API_URL || 'http://backend-api:4000',

  // Processing
  INTERVAL: process.env.BACKFILL_INTERVAL || 'ONE_MINUTE',
  KAFKA_BATCH_SIZE: 100,
  RATE_LIMIT_DELAY: 500, // ms between API calls per worker
};

// ═══════════════════════════════════════════════════════════════
// Global State
// ═══════════════════════════════════════════════════════════════
let redisClient = null;
let kafkaProducer = null;
const stats = {
  totalCandles: 0,
  totalSymbols: 0,
  successCount: 0,
  failCount: 0,
  skippedCount: 0,
  startTime: Date.now(),
};

// ═══════════════════════════════════════════════════════════════
// Backend API Helper
// ═══════════════════════════════════════════════════════════════
const backendApi = {
  async getDataAvailability(symbol) {
    try {
      const res = await axios.get(`${CONFIG.BACKEND_API_URL}/api/v1/data/availability?symbol=${symbol}`);
      const symbols = res.data?.data?.symbols || [];
      return symbols.length > 0 ? symbols[0] : null;
    } catch (e) {
      return null;
    }
  },

  async updateDataAvailability(params) {
    try {
      await axios.put(`${CONFIG.BACKEND_API_URL}/api/v1/data/availability`, params);
    } catch (e) {
      console.warn(`⚠️ Data availability update failed: ${e.message}`);
    }
  },

  async updateBackfillJob(jobId, params) {
    if (!jobId || jobId.startsWith('stream-')) return;
    try {
      await axios.patch(`${CONFIG.BACKEND_API_URL}/api/v1/backfill/${jobId}`, params);
    } catch (e) {}
  },
};

// ═══════════════════════════════════════════════════════════════
// Redis Progress Tracking (for Resume)
// ═══════════════════════════════════════════════════════════════
const progressTracker = {
  async saveCheckpoint(jobId, symbol, status) {
    if (!redisClient) return;
    const key = `backfill:checkpoint:${jobId}`;
    await redisClient.hSet(key, symbol, JSON.stringify({ status, timestamp: Date.now() }));
    await redisClient.expire(key, 86400 * 7); // 7 days TTL
  },

  async getCheckpoints(jobId) {
    if (!redisClient) return {};
    const key = `backfill:checkpoint:${jobId}`;
    const data = await redisClient.hGetAll(key);
    const result = {};
    for (const [symbol, json] of Object.entries(data)) {
      result[symbol] = JSON.parse(json);
    }
    return result;
  },

  async clearCheckpoints(jobId) {
    if (!redisClient) return;
    await redisClient.del(`backfill:checkpoint:${jobId}`);
  },

  async updateStatus(progress, details) {
    if (!redisClient) return;
    const statusObj = {
      job_id: CONFIG.JOB_ID,
      status: progress >= 100 ? 2 : 1, // 1=running, 2=complete
      progress: Math.round(progress),
      details,
      stats,
      timestamp: Date.now(),
    };
    await redisClient.set('system:layer1:backfill', JSON.stringify(statusObj));
  },
};

// ═══════════════════════════════════════════════════════════════
// Date Range Calculation
// ═══════════════════════════════════════════════════════════════
function calculateMissingRanges(requestedFrom, requestedTo, existing) {
  if (!existing || !existing.first_date || !existing.last_date) {
    return [{ from: requestedFrom, to: requestedTo }];
  }

  const reqFrom = DateTime.fromISO(requestedFrom);
  const reqTo = DateTime.fromISO(requestedTo);
  const existFirst = DateTime.fromISO(existing.first_date.split('T')[0]);
  const existLast = DateTime.fromISO(existing.last_date.split('T')[0]);

  const ranges = [];

  if (reqFrom < existFirst) {
    ranges.push({
      from: reqFrom.toISODate(),
      to: existFirst.minus({ days: 1 }).toISODate(),
    });
  }

  if (reqTo > existLast) {
    ranges.push({
      from: existLast.plus({ days: 1 }).toISODate(),
      to: reqTo.toISODate(),
    });
  }

  return ranges;
}

// ═══════════════════════════════════════════════════════════════
// Kafka Streaming
// ═══════════════════════════════════════════════════════════════
async function streamToKafka(symbol, candles, interval) {
  if (!kafkaProducer || candles.length === 0) return 0;

  const messages = candles.map((candle) => ({
    key: symbol,
    value: JSON.stringify({
      type: 'historical_candle',
      symbol,
      interval,
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5],
      source: 'mstock-streaming',
    }),
  }));

  // Send in batches
  for (let i = 0; i < messages.length; i += CONFIG.KAFKA_BATCH_SIZE) {
    const batch = messages.slice(i, i + CONFIG.KAFKA_BATCH_SIZE);
    await kafkaProducer.send({
      topic: CONFIG.KAFKA_TOPIC,
      messages: batch,
    });
  }

  return messages.length;
}

// ═══════════════════════════════════════════════════════════════
// Symbol Processing Worker
// ═══════════════════════════════════════════════════════════════
async function processSymbol(vendor, item, params, checkpoints) {
  const symbol = item.symbol;
  const token = item.tokens?.mstock;

  if (!token) {
    console.log(`   ⚠️ Skipping ${symbol} (no MStock token)`);
    return { symbol, status: 'skipped', reason: 'no_token' };
  }

  // Check if already processed (resume mode)
  if (CONFIG.RESUME && checkpoints[symbol]?.status === 'completed') {
    console.log(`   ⏭️ Skipping ${symbol} (already completed in this job)`);
    stats.skippedCount++;
    return { symbol, status: 'skipped', reason: 'already_completed' };
  }

  // Check data availability
  let rangesToFetch = [{ from: params.fromdate, to: params.todate }];

  if (!CONFIG.FORCE_REFETCH) {
    const existingData = await backendApi.getDataAvailability(symbol);

    if (existingData) {
      rangesToFetch = calculateMissingRanges(params.fromdate, params.todate, existingData);

      if (rangesToFetch.length === 0) {
        console.log(`   ⏭️ ${symbol} - Data exists (${existingData.first_date?.split('T')[0]} to ${existingData.last_date?.split('T')[0]})`);
        stats.skippedCount++;
        await progressTracker.saveCheckpoint(CONFIG.JOB_ID, symbol, 'skipped');
        return { symbol, status: 'skipped', reason: 'data_exists' };
      }
    }
  }

  // Fetch and stream each range
  let totalCandles = 0;
  const allDates = [];

  for (const range of rangesToFetch) {
    try {
      const fetchParams = {
        ...params,
        fromdate: range.from,
        todate: range.to,
        symboltoken: token,
      };

      const response = await vendor.fetchData(fetchParams);

      if (response.status && response.data && Array.isArray(response.data.candles)) {
        // Format candles
        const formattedCandles = response.data.candles.map((c) => {
          const [timeVal, o, h, l, cl, v] = Array.isArray(c)
            ? c
            : [c.timestamp, c.open, c.high, c.low, c.close, c.volume];

          let dt;
          const timeStr = String(timeVal);

          if (timeStr.includes('T')) {
            dt = DateTime.fromISO(timeStr);
          } else if (/^\d{10}$/.test(timeStr)) {
            dt = DateTime.fromSeconds(parseInt(timeStr));
          } else if (/^\d{13}$/.test(timeStr)) {
            dt = DateTime.fromMillis(parseInt(timeStr));
          } else {
            dt = DateTime.fromFormat(timeStr, 'yyyy-MM-dd HH:mm');
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

        // Stream to Kafka
        const sent = await streamToKafka(symbol, formattedCandles, CONFIG.INTERVAL);
        totalCandles += sent;

        // Track dates for availability update
        formattedCandles.forEach(c => allDates.push(c[0].split(' ')[0]));

        console.log(`   📤 ${symbol}: Streamed ${sent} candles (${range.from} to ${range.to})`);
      }

      // Rate limiting
      await new Promise(r => setTimeout(r, CONFIG.RATE_LIMIT_DELAY));

    } catch (err) {
      console.error(`   ❌ ${symbol}: Error fetching ${range.from}-${range.to}: ${err.message}`);
    }
  }

  // Update data availability
  if (totalCandles > 0 && allDates.length > 0) {
    allDates.sort();
    await backendApi.updateDataAvailability({
      symbol,
      timeframe: CONFIG.INTERVAL,
      firstDate: allDates[0],
      lastDate: allDates[allDates.length - 1],
      recordCount: totalCandles,
    });
  }

  // Save checkpoint
  await progressTracker.saveCheckpoint(CONFIG.JOB_ID, symbol, 'completed');

  stats.totalCandles += totalCandles;
  stats.successCount++;

  return { symbol, status: 'completed', candles: totalCandles };
}

// ═══════════════════════════════════════════════════════════════
// Parallel Worker Pool
// ═══════════════════════════════════════════════════════════════
async function runWorkerPool(vendor, symbols, params, checkpoints) {
  const queue = [...symbols];
  const workers = [];
  const results = [];
  let processed = 0;

  const worker = async (workerId) => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;

      console.log(`\n🔄 [Worker ${workerId}] Processing ${item.symbol}...`);

      try {
        const result = await processSymbol(vendor, item, params, checkpoints);
        results.push(result);
      } catch (err) {
        console.error(`   ❌ [Worker ${workerId}] ${item.symbol}: ${err.message}`);
        results.push({ symbol: item.symbol, status: 'failed', error: err.message });
        stats.failCount++;
      }

      processed++;
      const progress = (processed / symbols.length) * 100;
      await progressTracker.updateStatus(progress, `Processed ${processed}/${symbols.length} symbols`);
    }
  };

  // Start workers
  console.log(`\n🚀 Starting ${CONFIG.WORKERS} parallel workers...`);
  for (let i = 1; i <= CONFIG.WORKERS; i++) {
    workers.push(worker(i));
  }

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

// ═══════════════════════════════════════════════════════════════
// Main Entry Point
// ═══════════════════════════════════════════════════════════════
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     🚀 STREAMING BACKFILL - PARALLEL WORKERS               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Calculate date range
  const today = DateTime.now().startOf('day');
  let startDate, endDate;

  if (CONFIG.FROM_DATE && CONFIG.TO_DATE) {
    startDate = DateTime.fromISO(CONFIG.FROM_DATE);
    endDate = DateTime.fromISO(CONFIG.TO_DATE);
  } else {
    endDate = today;
    startDate = today.minus({ days: CONFIG.HISTORY_DAYS });
  }

  // Cap end date to today
  if (endDate > today) {
    endDate = today;
  }

  const params = {
    exchange: 'NSE',
    interval: CONFIG.INTERVAL,
    fromdate: startDate.toISODate(),
    todate: endDate.toISODate(),
  };

  console.log(`📋 Configuration:`);
  console.log(`   Workers:    ${CONFIG.WORKERS}`);
  console.log(`   Date Range: ${params.fromdate} to ${params.todate}`);
  console.log(`   Kafka:      ${CONFIG.KAFKA_BROKERS.join(', ')} → ${CONFIG.KAFKA_TOPIC}`);
  console.log(`   Force:      ${CONFIG.FORCE_REFETCH}`);
  console.log(`   Resume:     ${CONFIG.RESUME}`);
  console.log(`   Job ID:     ${CONFIG.JOB_ID}`);

  // Filter symbols
  let processList = masterMap.filter(item => item.tokens?.mstock);
  if (CONFIG.TARGET_SYMBOL) {
    processList = processList.filter(item => item.symbol === CONFIG.TARGET_SYMBOL);
  }

  stats.totalSymbols = processList.length;
  console.log(`   Symbols:    ${processList.length}\n`);

  // Connect to Redis
  try {
    redisClient = redis.createClient({ url: CONFIG.REDIS_URL });
    await redisClient.connect();
    console.log('✅ Connected to Redis');
  } catch (e) {
    console.warn('⚠️ Redis not available - progress tracking disabled');
  }

  // Connect to Kafka
  try {
    const kafka = new Kafka({
      clientId: 'layer-1-streaming-backfill',
      brokers: CONFIG.KAFKA_BROKERS,
      connectionTimeout: 10000,
      retry: { initialRetryTime: 500, retries: 10 },
    });
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log('✅ Connected to Kafka');
  } catch (e) {
    console.error('❌ Kafka connection failed:', e.message);
    process.exit(1);
  }

  // Initialize vendor
  const vendor = new MStockVendor();
  try {
    await vendor.connect();
    console.log('✅ Authenticated with MStock');
  } catch (e) {
    console.error('❌ MStock auth failed:', e.message);
    process.exit(1);
  }

  // Get checkpoints for resume
  const checkpoints = CONFIG.RESUME ? await progressTracker.getCheckpoints(CONFIG.JOB_ID) : {};
  if (CONFIG.RESUME && Object.keys(checkpoints).length > 0) {
    console.log(`📋 Resuming job - ${Object.keys(checkpoints).length} symbols already processed`);
  }

  // Run parallel workers
  await progressTracker.updateStatus(0, 'Starting backfill...');
  const results = await runWorkerPool(vendor, processList, params, checkpoints);

  // Summary
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 BACKFILL COMPLETE                    ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Successful:  ${String(stats.successCount).padStart(5)}                                  ║`);
  console.log(`║  ⏭️  Skipped:     ${String(stats.skippedCount).padStart(5)}                                  ║`);
  console.log(`║  ❌ Failed:      ${String(stats.failCount).padStart(5)}                                  ║`);
  console.log(`║  📊 Candles:     ${String(stats.totalCandles).padStart(5)}                                  ║`);
  console.log(`║  ⏱️  Duration:    ${String(duration + 's').padStart(5)}                                  ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Update final status
  await progressTracker.updateStatus(100, 'Backfill complete');
  await backendApi.updateBackfillJob(CONFIG.JOB_ID, {
    status: 'COMPLETED',
    processed: stats.successCount,
    errors: stats.failCount,
  });

  // Cleanup
  await vendor.disconnect();
  if (kafkaProducer) await kafkaProducer.disconnect();
  if (redisClient) await redisClient.quit();

  console.log('✅ Cleanup complete. Exiting.');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
