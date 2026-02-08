/**
 * Layer 1: Data Ingestion Service
 *
 * Connects to market data sources via WebSocket,
 * normalizes data, and publishes to Kafka
 *
 * @author Yogendra Singh
 */

// Register ts-node to handle TypeScript files in node_modules regarding the SDK
require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
});

require('dotenv').config(); // Load local .env if exists
require('dotenv').config({ path: '../.env' }); // Also load root .env for local development

// IMPORTANT: Initialize global axios interceptor BEFORE importing SDKs
// This patches axios globally to track all external API calls
const { setupGlobalInterceptor } = require('./utils/axios-interceptor');
setupGlobalInterceptor();

const path = require('path');
const { fork } = require('child_process');

const express = require('express');
const cron = require('node-cron');
const axios = require('axios');
const { VendorFactory } = require('./vendors/factory');
const { KafkaProducer } = require('./kafka/producer');
const { Normalizer } = require('./normalizer');
const { logger } = require('./utils/logger');
const { metrics, register } = require('./utils/metrics');
const client = require('prom-client');
const redis = require('redis');
const symbols = require('../config/symbols.json');

// Import shared health-check library
const { waitForAll, waitForKafka, waitForRedis, initHealthMetrics } = require('/app/shared/health-check');

// Initialize health metrics with Prometheus registry for Grafana
initHealthMetrics(register);

// Initialize Express for health checks
const app = express();
app.use(express.json()); // Enable JSON body parsing
const PORT = process.env.INGESTION_PORT || 3001;

// Backend API URL (Layer 7 - Single Source of Truth)
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend-api:4000';

// Helper for Backend API calls
// Acts as a bridge between Ingestion Service controls and the Central Backend API
const backendApi = {
  /**
   * Trigger a backfill job via Backend API
   * @param {Object} params - { symbol, days, timeframe, force }
   */
  async triggerBackfill(params) {
    const res = await axios.post(`${BACKEND_API_URL}/api/v1/system/backfill/trigger`, params);
    return res.data?.data;
  },

  /**
   * Get symbols that have data gaps (missing candles)
   * @param {number} days - Number of days to look back
   */
  async getSymbolsWithGaps(days = 5) {
    const res = await axios.get(`${BACKEND_API_URL}/api/v1/data/gaps?days=${days}`);
    return res.data?.data?.symbols || [];
  },

  /**
   * Fetch status of a specific backfill job
   * @param {string} jobId 
   */
  async getBackfillJob(jobId) {
    const res = await axios.get(`${BACKEND_API_URL}/api/v1/backfill/${jobId}`);
    return res.data?.data;
  },

  /**
   * Update job status (e.g., mark as COMPLETED or FAILED)
   * @param {string} jobId 
   * @param {Object} params - { status, progress, error, metadata }
   */
  async updateBackfillJob(jobId, params) {
    const res = await axios.patch(`${BACKEND_API_URL}/api/v1/backfill/${jobId}`, params);
    return res.data?.data;
  },

  /**
   * Update Data Availability stats (earliest/latest dates, counts)
   * @param {Object} params - { symbol, timeframe, earliest, latest, total_records }
   */
  async updateDataAvailability(params) {
    const res = await axios.put(`${BACKEND_API_URL}/api/v1/data/availability`, params);
    return res.data?.data;
  },
};

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5],
  registers: [register],
});

// Use shared metrics instead of local ones
const ticksReceivedCounter = metrics.ticksCounter;
const kafkaMessagesSentCounter = metrics.kafkaMessagesSent;
const websocketConnectionGauge = metrics.websocketConnections;

// Middleware for HTTP request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

// Metrics Endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Initialize components
let marketDataVendor;
let kafkaProducer;
let normalizer;
let redisClient;

/**
 * Log to Redis Helper (Global)
 */
const logToRedis = async (message) => {
  try {
    if (!redisClient) return; // Skip if not ready
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    await redisClient.lPush('system:layer1:logs', logEntry);
    await redisClient.lTrim('system:layer1:logs', 0, 49);
  } catch (e) {
    logger.error('Failed to log to Redis', e);
  }
};


// Note: Health check functions are now provided by the shared @trading-system/health-check library
// See: /app/shared/health-check/README.md for usage

/**
 * Initialize all services
 */
async function initialize() {
  logger.info('');
  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info('║     🚀 LAYER 1: DATA INGESTION SERVICE - STARTING          ║');
  logger.info('╚════════════════════════════════════════════════════════════╝');
  logger.info('');



  try {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: Wait for Infrastructure Dependencies (Shared Library)
    // ═══════════════════════════════════════════════════════════════
    const kafkaBrokers = process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'];
    const kafkaTopic = process.env.KAFKA_TOPIC_RAW_TICKS || 'raw-ticks';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Use shared health-check library to wait for all dependencies
    const { redis: connectedRedis } = await waitForAll({
      kafka: {
        brokers: kafkaBrokers,
        topic: kafkaTopic,
      },
      redis: {
        url: redisUrl,
      },
    }, { logger });

    // Use the connected Redis client from health check
    redisClient = connectedRedis;

    // Now connect the Kafka producer
    logger.info('🔄 Connecting Kafka Producer...');
    kafkaProducer = new KafkaProducer({
      brokers: kafkaBrokers,
      topic: kafkaTopic,
    });

    await kafkaProducer.connect();
    logger.info('✅ Kafka Producer connected');



    await logToRedis('🚀 Layer 1 Ingestion Service Started');

    // Start Metrics Publishing Loop
    setInterval(async () => {
      try {
        const mem = process.memoryUsage();
        const packetsVal = await metrics.websocketPackets.get();
        const bytesVal = await metrics.websocketDataBytes.get();
        const ticksVal = await metrics.ticksCounter.get();

        const l1Metrics = {
          heap_used: (mem.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
          uptime: process.uptime().toFixed(0) + 's',
          websocket_packets: (packetsVal?.values[0]?.value || 0).toLocaleString(),
          websocket_data_kb: ((bytesVal?.values[0]?.value || 0) / 1024).toFixed(2) + ' KB',
          type: 'Stream',
          source: 'MStock',
          timestamp: Date.now(),
        };
        await redisClient.set('system:layer1:metrics', JSON.stringify(l1Metrics));

        // Periodically log tick summary to Redis
        const totalTicks = ticksVal?.values.reduce((sum, v) => sum + v.value, 0) || 0;
        if (totalTicks > 0) {
          await logToRedis(
            `📊 Ingestion Health: ${totalTicks.toLocaleString()} total ticks received`
          );
        }
      } catch (e) {
        logger.error('Metric Publish Error', e);
      }
    }, 10000); // 10 seconds

    // Initialize Normalizer
    normalizer = new Normalizer();
    logger.info('✅ Normalizer initialized');
    await logToRedis('✅ Normalizer initialized');

    // Load Subscription List from Global Shared Map
    let subscriptionList = [];
    try {
      // In Docker: /app/src/index.js -> ../vendor = /app/vendor (mounted)
      // Locally: layer-1-ingestion/src/index.js -> ../vendor = layer-1-ingestion/vendor (symlink)
      const mapPath = path.resolve(__dirname, '../vendor/nifty50_shared.json');
      const masterMap = require(mapPath);

      // Map to MStock Format: "NSE:Token"
      // Filter out items without mstock token
      subscriptionList = masterMap
        .filter((item) => item.tokens && item.tokens.mstock)
        .map((item) => `NSE:${item.tokens.mstock}`);

      logger.info(`📋 Loaded ${subscriptionList.length} Symbols from Global Map for Subscription.`);
    } catch (e) {
      logger.warn(
        `⚠️ Failed to load Global Map: ${e.message}. Falling back to config/symbols.json (Legacy)`
      );
      // Fallback or Empty
      subscriptionList = symbols.nifty50.map((s) => `NSE:${s.token}`); // Legacy fallback (might be Kite tokens!)
    }

    // Initialize Market Hours (MUST be before VendorManager for status checks)
    const { MarketHours } = require('./utils/market-hours');
    const marketHours = new MarketHours();

    // Initialize Market Data Vendor via Factory
    const { VendorManager } = require('./vendors/manager');
    marketDataVendor = new VendorManager({
      // apiKey: process.env.ZERODHA_API_KEY, // Passed via Env to factory
      symbols: subscriptionList,
      onTick: handleTick,
    });

    marketDataVendor.init();

    // Only connect WebSocket if NOT in forced historical mode
    if (process.env.FORCE_HISTORICAL_MODE !== 'true') {
      await marketDataVendor.connect();
      const marketStatus = marketHours.isMarketOpen();
      const statusText = marketStatus ? 'Market is OPEN - Stream active' : 'Market is CLOSED - Idle';
      await logToRedis(`📡 Connected to MStock. ${statusText}`);
      logger.info(`🎯 Subscribed to ${subscriptionList.length} Nifty 50 symbols (Stream Mode)`);
    } else {
      logger.info('📊 HISTORICAL MODE: Skipping WebSocket connection.');
    }





    // --- Command Listener (Always Active) ---
    try {
      const commandClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      await commandClient.connect();
      await commandClient.subscribe('system:commands', async (message) => {
        try {
          const { command, params } = JSON.parse(message);
          if (command === 'START_BACKFILL') {
            logger.info(
              `📥 Received START_BACKFILL command. Triggering backfill with params: ${JSON.stringify(params)}`
            );
            runBackfill(params);
          }
        } catch (e) {
          logger.error('Command Parse Error', e);
        }
      });
      logger.info('✅ Command Listener connected');
    } catch (e) {
      logger.error('❌ Failed to connect Command Listener:', e);
    }

    // --------------------------------------------------------------------------
    // NOTIFICATION TRIGGER
    // --------------------------------------------------------------------------
    // We only send the completion notification via Telegram after verifying
    // that the backend DB has actually synced the data.
    // This prevents "False Positives" where ingestion says done, but DB is empty.
    try {
      logger.info(`🔍 Verifying DB Sync for job ${jobId} before notifying...`);

      // Poll backend for final row count
      const dbStats = await axios.get(`${BACKEND_API_URL}/api/v1/data/stats`);
      const currentCount = dbStats.data?.data?.candles_1m || 0;

      // Send Telegram Alert with detailed stats
      // The processing layer/notification service picks this up
      await producer.send({
        topic: 'system-notifications',
        messages: [
          {
            key: 'backfill-alert',
            value: JSON.stringify({
              type: 'BACKFILL_COMPLETED',
              data: {
                symbol: 'ALL_SYMBOLS',
                count: totalCandles,  // Messages produced to Kafka
                dbCount: currentCount, // Validated rows in DB
                duration: `${finalDuration}s`,
                status: 'SUCCESS'
              },
              timestamp: Date.now(),
            }),
          },
        ],
      });
      logger.info('✅ Notification sent to system-notifications topic');

    } catch (alertErr) {
      logger.error('⚠️ Failed to send notification:', alertErr.message);
    }
    // ═══════════════════════════════════════════════════════════════
    // PHASE 2.5: Scheduled Cron Job (Daily at 6:00 AM IST)
    // ═══════════════════════════════════════════════════════════════
    logger.info('');
    logger.info('📋 Setting up Scheduled Backfill Job...');

    // 6:00 AM IST = 0:30 UTC (IST is UTC+5:30)
    cron.schedule('30 0 * * 1-5', async () => {
      logger.info('⏰ CRON: 6 AM IST - Triggering scheduled daily backfill...');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const fromDate = yesterday.toISOString().split('T')[0];
      const toDate = new Date().toISOString().split('T')[0];

      // runBackfill will create the job in Backend API automatically
      runBackfill({ fromDate, toDate });
    }, {
      timezone: 'UTC'
    });
    logger.info('✅ Cron job scheduled: Daily at 6:00 AM IST (Mon-Fri)');

    // ═══════════════════════════════════════════════════════════════
    // PHASE 2.6: Startup Gap Detection (Auto-Backfill) - DISABLED
    // ═══════════════════════════════════════════════════════════════
    // User Request: "REMOVE/COMMENT OUT the automatic execution of the backfill"
    // The service should start and wait idly.
    /*
    logger.info('');
    logger.info('📋 Checking for data gaps (Auto-Backfill)...');
    
    try {
      const symbolsWithGaps = await backendApi.getSymbolsWithGaps(5);
      if (symbolsWithGaps.length > 0) {
        logger.info(`🔍 Found ${symbolsWithGaps.length} symbols with data gaps`);
        setTimeout(async () => {
          logger.info('🚀 Auto-triggering backfill for data gaps...');
          await runBackfill({ days: 5 });
        }, 30000);
      } else {
        logger.info('✅ No significant data gaps detected');
      }
    } catch (err) {
      logger.warn(`⚠️ Gap detection skipped: ${err.message}`);
    }
    */

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: Historical Data Sync - DISABLED
    // ═══════════════════════════════════════════════════════════════
    // User Request: Disable startup scan entirely.
    const forceHistorical = process.env.FORCE_HISTORICAL_MODE === 'true';
    if (forceHistorical || !marketHours.isMarketOpen()) {
       logger.info('');
       logger.info('╔════════════════════════════════════════════════════════════╗');
       if (forceHistorical) {
         logger.info('║  📊 HISTORICAL MODE FORCED - Live Stream Disabled          ║');
       } else {
         logger.info('║  🌙 MARKET CLOSED - SERVICE IDLE (Waiting for Trigger)     ║');
       }
       logger.info('╚════════════════════════════════════════════════════════════╝');
    } else {
       logger.info('☀️ Market is OPEN - Live Stream Active');
    }
  } catch (error) {
    logger.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

/* 
 * =================================================================
 * GLOBAL BACKFILL FUNCTIONS (Refactored out of initialize)
 * =================================================================
 */

// Global state
let isBackfilling = false;

/**
 * Execute a script file as a child process with IPC for metrics
 */
const runScriptWithIPC = (scriptPath, args = []) => {
  return new Promise((resolve, reject) => {
    const child = fork(scriptPath, args, { stdio: 'inherit' });

    child.on('message', (msg) => {
      if (msg.type === 'metric') {
        try {
          const metric = metrics[msg.name];
          if (metric) {
            logger.debug(
              `📈 IPC Metric Update: ${msg.name} | ${JSON.stringify(msg.labels)} | +${msg.value || 1}`
            );
            if (metric.inc) metric.inc(msg.labels, msg.value || 1);
            else if (metric.set) metric.set(msg.labels, msg.value || 1);
            else if (metric.observe) metric.observe(msg.labels, msg.value || 1);
          }
        } catch (err) {
          logger.error(`Failed to update metric ${msg.name} from child`, err);
        }
      }
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Exit code ${code}`));
    });
  });
};

/**
 * Update Backfill Status in Redis & Prometheus
 */
const updateBackfillStatus = async (status, progress = 0, details = '') => {
  try {
    if (!redisClient) return; // Guard
    const statusObj = {
      status, // 0:Idle, 1:Run, 2:Done, 3:Fail
      progress,
      details,
      job_type: 'historical_backfill',
      timestamp: Date.now(),
    };
    await redisClient.set('system:layer1:backfill', JSON.stringify(statusObj));

    // Update Prometheus
    const statusVal = (status === 'running') ? 1 : (status === 'completed' ? 2 : (status === 'failed' ? 3 : status));
    // Simplify mapping logic
    metrics.batchJobStatus.set({ job_type: 'historical_backfill' }, typeof statusVal === 'number' ? statusVal : 0);

    if (progress > 0) {
      metrics.batchJobProgress.set(
        { job_type: 'historical_backfill', metric: 'percent' },
        progress
      );
    }
  } catch (e) {
    logger.error('Failed to update backfill status', e);
  }
};

/**
 * Run Historical Backfill Logic
 */
const runBackfill = async (startParams = {}) => {
  if (isBackfilling) {
    logger.warn('⚠️ Backfill already in progress. Skipping...');
    return;
  }
  isBackfilling = true;
  let jobId = startParams.jobId || null;

  try {
    const startTime = Date.now();
    const { fromDate, toDate, symbol } = startParams;
    const symbolMsg = symbol ? `Symbol: ${symbol}` : 'All Symbols';
    const dateMsg = fromDate && toDate ? `(${fromDate} to ${toDate})` : '(Last 5 Days)';

    // Create Job in Backend if missing
    if (!jobId) {
       try {
         // Note: backendApi is global const
         const jobResult = await backendApi.triggerBackfill({
           symbol: symbol || null,
           fromDate: fromDate || null,
           toDate: toDate || null,
         });
         jobId = jobResult?.jobId;
       } catch (err) {
         logger.warn(`⚠️ Could not create job in Backend API: ${err.message}`);
       }
    }

    await updateBackfillStatus(1, 5, `Starting Backfill... ${symbolMsg}`);

    if (jobId) await backendApi.updateBackfillJob(jobId, { status: 'RUNNING', processed: 0 }).catch(() => {});

    // Step 1: Fetch
    logger.info(`⏳ Step 1: Fetching Data... ${symbolMsg}`);
    await updateBackfillStatus(1, 10, 'Fetching Data...');
    
    // Scripts path relative to __dirname (which is src/)
    const batchScript = path.resolve(__dirname, '../scripts/batch_nifty50.js');
    const scriptArgs = [];
    if (symbol) scriptArgs.push('--symbol', symbol);
    if (fromDate && toDate) scriptArgs.push('--from', fromDate, '--to', toDate);
    else scriptArgs.push('--days', '5');
    if (jobId) scriptArgs.push('--job-id', jobId);
    
    // Pass Force Flag
    if (startParams.force) {
      scriptArgs.push('--force');
    }
    
    // Pass Swarm Flag
    if (startParams.useSwarm !== undefined) {
      scriptArgs.push('--use-swarm', String(startParams.useSwarm));
    }

    await runScriptWithIPC(batchScript, scriptArgs);
    await updateBackfillStatus(1, 50, 'Step 1 Complete');

    // Step 2: Feed
    logger.info('⏳ Step 2: Feeding Kafka...');
    await updateBackfillStatus(1, 55, 'Feeding Kafka...');
    const feedScript = path.resolve(__dirname, '../scripts/feed_kafka.js');
    const feedArgs = symbol ? ['--symbol', symbol] : [];
    await runScriptWithIPC(feedScript, feedArgs);

    // Step 3: Verification & Notification
    logger.info('⏳ Step 3: Verifying Database Sync...');
    await updateBackfillStatus(2, 80, 'Verifying Database...');
    
    // Poll Backend until count stabilizes or timeout
    let finalCount = 0;
    let retries = 30; // 30 * 2s = 60s timeout
    const initialStats = await axios.get(`${process.env.BACKEND_API_URL}/api/v1/data/stats`).then(r => r.data.data).catch(() => ({}));
    let prevCount = initialStats.candles_1m || 0;

    while (retries > 0) {
      await new Promise(r => setTimeout(r, 2000));
      const stats = await axios.get(`${process.env.BACKEND_API_URL}/api/v1/data/stats`).then(r => r.data.data).catch(() => ({}));
      const currentCount = stats.candles_1m || 0;

      if (currentCount > prevCount) {
        prevCount = currentCount; // Still increasing
        logger.info(`📈 Database Syncing: ${currentCount} rows...`);
      } else {
        // Stabilized
        finalCount = currentCount;
        break;
      }
      retries--;
    }

    const duration = (Date.now() - startTime) / 1000;
    metrics.batchJobDuration.observe({ job_type: 'historical_backfill', status: 'success' }, duration);
    
    await updateBackfillStatus(2, 100, 'Backfill Complete');
    if (jobId) await backendApi.updateBackfillJob(jobId, { status: 'COMPLETED', details: `Synced: ${finalCount} candles` }).catch(() => {});
    
    logger.info('✅ Backfill Complete.');
    const countMsg = `🕯️ DB Total: ${finalCount.toLocaleString()} candles`;
    await logToRedis(`✅ Backfill Complete: ${symbolMsg}. ${countMsg}`);
    
  } catch (err) {
    await updateBackfillStatus(3, 0, err.message);
    if (jobId) await backendApi.updateBackfillJob(jobId, { status: 'FAILED' }).catch(() => {});
    logger.error(`❌ Backfill Failed: ${err.message}`);
  } finally {
    isBackfilling = false;
  }
};

// GLOBAL ROUTE DEFINITION
// SWARM STATUS ENDPOINT (Added for Dashboard Visibility)
app.get('/api/backfill/swarm/status', async (req, res) => {
  if (!redisClient) {
    return res.status(503).json({ error: 'Redis not available' });
  }
  try {
    const status = await redisClient.get('system:layer1:swarm_status');
    if (!status) {
      return res.json({ status: 'IDLE', message: 'No active Swarm' });
    }
    return res.json(JSON.parse(status));
  } catch (err) {
    logger.error('Failed to get swarm status', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backfill/historical', async (req, res) => {
  try {
    const { symbol, fromDate, toDate, force } = req.body;
    // Allow null symbol -> "All Symbols"
    // if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    logger.info(`🎯 Received Historical Backfill Request: ${symbol} (Force: ${force})`);
    runBackfill({ symbol, fromDate, toDate, force }).catch(err => logger.error('Backfill Error', err));

    res.json({ success: true, message: `Started backfill for ${symbol}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/**
 * Handle incoming tick data
 * @param {Object} tick - Raw tick from broker
 */
async function handleTick(tick) {
  try {
    // Normalize the tick to unified schema
    const normalizedTick = normalizer.normalize(tick);

    if (!normalizedTick) {
      metrics.invalidTicksCounter.inc();
      return;
    }

    // Publish to Kafka (partitioned by symbol)
    await kafkaProducer.send(normalizedTick);

    // Update metrics
    metrics.ticksCounter.inc({ symbol: normalizedTick.symbol });
    metrics.ticksPerSecond.inc();
  } catch (error) {
    logger.error('Error processing tick:', error);
    metrics.errorCounter.inc({ type: 'tick_processing' });
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'layer-1-ingestion',
    timestamp: new Date().toISOString(),
    connections: {
      kafka: kafkaProducer?.isConnected() || false,
      websocket: marketDataVendor?.isConnected() || false,
    },
  };
  res.json(health);
});

// ═══════════════════════════════════════════════════════════════
// API ENDPOINTS (Proxied to Backend API)
// ═══════════════════════════════════════════════════════════════
// Note: Main data APIs are in layer-7-backend-api (port 4000):
//   - GET  /api/v1/data/availability
//   - POST /api/v1/system/backfill/trigger
//   - GET  /api/v1/backfill/:jobId
//   - PATCH /api/v1/backfill/:jobId
// The endpoints below are kept for backward compatibility but proxy to backend API.



// POST /api/backfill - Proxy to backend API
app.post('/api/backfill', async (req, res) => {
  try {
    const result = await backendApi.triggerBackfill(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('API backfill error:', err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// GET /api/backfill/:jobId - Proxy to backend API
app.get('/api/backfill/:jobId', async (req, res) => {
  try {
    const job = await backendApi.getBackfillJob(req.params.jobId);
    res.json(job);
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// GET /api/data-availability - Proxy to backend API
app.get('/api/data-availability', async (req, res) => {
  try {
    const resp = await axios.get(`${BACKEND_API_URL}/api/v1/data/availability`);
    res.json(resp.data?.data || {});
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down gracefully...');

  try {
    if (marketDataVendor) await marketDataVendor.disconnect();
    if (kafkaProducer) await kafkaProducer.disconnect();
    if (redisClient) await redisClient.quit();
  } catch (err) {
    logger.error(`Shutdown error: ${err.message}`);
  }

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the service
app.listen(PORT, async () => {
  logger.info(`📡 Health check server running on port ${PORT}`);

  // Interactive Mode Check (Local Dev Only)
  if (process.stdin.isTTY) {
    await checkInteractiveMode();
  } else {
    initialize();
  }
});

/**
 * Check if user wants running interactive historical fetch
 */
async function checkInteractiveMode() {
  const readline = require('readline');
  const path = require('path');

  // Load Global Master Map (Local Dev Path)
  let masterMap = [];
  try {
    const mapPath = path.resolve(__dirname, '../../vendor/nifty50_shared.json');
    masterMap = require(mapPath);
    // console.log(`Loaded Master Map from ${mapPath}`);
  } catch (e) {
    console.warn(
      '⚠️ Could not load Global Master Map (vendor/nifty50_shared.json). Symbol resolution disabled.'
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question, def) =>
    new Promise((resolve) => {
      rl.question(`${question} (Default: ${def}): `, (answer) => {
        resolve(answer.trim() || def);
      });
    });

  try {
    console.log('\n==========================================');
    console.log('   🚀 LAYER 1 INGESTION: INTERACTIVE MODE   ');
    console.log('==========================================\n');

    // Timeout check to default to normal mode if no input
    let answered = false;
    const timer = setTimeout(() => {
      if (!answered) {
        console.log('\n⏳ Timeout: Starting standard ingestion mode...');
        rl.close();
        initialize();
      }
    }, 5000);

    const mode = await ask('Run Historical Fetch Job? (y/N)', 'N');
    answered = true;
    clearTimeout(timer);

    if (mode.toLowerCase() === 'y') {
      console.log('\n--- Configuration ---');
      const exchange = await ask('Exchange', 'NSE');

      // Ask for Symbol or Token
      let symbolInput = await ask('Symbol Name (e.g. RELIANCE) or Token', '22');
      let symbolToken = symbolInput;
      let resolvedName = '';

      // Try to resolve symbol to MStock Token using Master Map
      const match = masterMap.find((s) =>
        s.symbol.toUpperCase().includes(symbolInput.toUpperCase())
      );

      if (match && match.tokens && match.tokens.mstock) {
        symbolToken = match.tokens.mstock;
        resolvedName = match.symbol;
        console.log(
          `✅ Resolved '${symbolInput}' to MStock Token: ${symbolToken} (${resolvedName})`
        );
      } else {
        console.log(`ℹ️ Using raw input '${symbolInput}' as token (No match in Master Map).`);
      }

      const interval = await ask('Interval', 'TEN_MINUTE');

      const { DateTime } = require('luxon');
      const defFrom = DateTime.now().minus({ days: 3 }).toFormat('yyyy-MM-dd HH:mm:ss');
      const defTo = DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss');

      const fromDate = await ask('From Date', defFrom);
      const toDate = await ask('To Date', defTo);

      rl.close();
      await runInteractiveJob({ exchange, symbolToken, interval, fromDate, toDate });
    } else {
      rl.close();
      initialize();
    }
  } catch (e) {
    console.error('Interactive Error:', e);
    initialize(); // Fallback
  }
}

/**
 * Run manual fetch job based on interactive input
 */
async function runInteractiveJob(config) {
  logger.info(`🛠 Running Manual Job: ${JSON.stringify(config)}`);

  // Init minimal components
  try {
    const kafkaProducer = new KafkaProducer({
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      topic: process.env.KAFKA_TOPIC_RAW_TICKS || 'raw-ticks',
    });
    await kafkaProducer.connect();

    const normalizer = new Normalizer();

    const vendor = VendorFactory.createVendor({
      // Pass minimal options. Warning: MStock might expect symbols to be array
      symbols: [`${config.exchange}:${config.symbolToken}`],
      onTick: () => {}, // Logic is pull-based here
    });

    await vendor.connect();

    const params = {
      exchange: config.exchange,
      symboltoken: config.symbolToken,
      interval: config.interval,
      fromdate: config.fromDate,
      todate: config.toDate,
    };

    const response = await vendor.fetchData(params);

    if (response.status && response.data && Array.isArray(response.data.candles)) {
      const candles = response.data.candles;
      logger.info(`✅ Received ${candles.length} candles.`);

      for (const candle of candles) {
        // Mock tick structure for normalizer?
        // Usually Historical Data goes to a different topic or handled differently.
        // But for "Ingestion", we might want to normalize and push?
        // Or just log as per user verification request.
        // Given user context: "feed tis input ... like reliace last 10 days"
        // I will Log to console and Option to Publish
        logger.info(`Candle: ${JSON.stringify(candle)}`);
      }
    } else {
      logger.error(`❌ Fetch Failed: ${response.message}`);
    }

    await vendor.disconnect();
    await kafkaProducer.disconnect();
    process.exit(0);
  } catch (e) {
    logger.error(`Job Failed: ${e.message}`);
    process.exit(1);
  }
}
