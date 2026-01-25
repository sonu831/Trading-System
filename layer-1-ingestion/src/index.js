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
const { VendorFactory } = require('./vendors/factory');
const { KafkaProducer } = require('./kafka/producer');
const { Normalizer } = require('./normalizer');
const { logger } = require('./utils/logger');
const { metrics, register } = require('./utils/metrics');
const client = require('prom-client');
const symbols = require('../config/symbols.json');

// Initialize Express for health checks
const app = express();
const PORT = process.env.INGESTION_PORT || 3001;

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

/**
 * Wait for a dependency to be ready with retries
 */
async function waitForDependency(name, checkFn, maxRetries = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await checkFn();
      logger.info(`✅ ${name} is ready (attempt ${attempt}/${maxRetries})`);
      return true;
    } catch (error) {
      if (attempt === maxRetries) {
        logger.error(`❌ ${name} failed to connect after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      logger.warn(`⏳ Waiting for ${name}... (attempt ${attempt}/${maxRetries}) - ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Initialize all services
 */
async function initialize() {
  logger.info('');
  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info('║     🚀 LAYER 1: DATA INGESTION SERVICE - STARTING          ║');
  logger.info('╚════════════════════════════════════════════════════════════╝');
  logger.info('');

  const redis = require('redis');
  let redisClient;

  try {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: Wait for Infrastructure Dependencies
    // ═══════════════════════════════════════════════════════════════
    logger.info('📋 PHASE 1: Checking Infrastructure Dependencies...');
    logger.info('─'.repeat(60));

    // Wait for Redis to be ready
    logger.info('🔄 Connecting to Redis...');
    await waitForDependency('Redis', async () => {
      redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      redisClient.on('error', (err) => {
        if (!err.message.includes('ECONNREFUSED')) {
          logger.error('Redis Client Error', err);
        }
      });
      await redisClient.connect();
    });

    // Wait for Kafka to be ready
    logger.info('🔄 Connecting to Kafka...');
    kafkaProducer = new KafkaProducer({
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      topic: process.env.KAFKA_TOPIC_RAW_TICKS || 'raw-ticks',
    });

    await waitForDependency('Kafka', async () => {
      await kafkaProducer.connect();
    });

    logger.info('');
    logger.info('✅ PHASE 1 COMPLETE: All infrastructure dependencies ready!');
    logger.info('─'.repeat(60));
    logger.info('');

    const logToRedis = async (message) => {
      try {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        await redisClient.lPush('system:layer1:logs', logEntry);
        await redisClient.lTrim('system:layer1:logs', 0, 49);
      } catch (e) {
        logger.error('Failed to log to Redis', e);
      }
    };

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
    await marketDataVendor.connect();

    const marketStatus = marketHours.isMarketOpen();
    const statusText = marketStatus ? 'Market is OPEN - Stream active' : 'Market is CLOSED - Idle';
    await logToRedis(`📡 Connected to MStock. ${statusText}`);
    logger.info(`🎯 Subscribed to ${subscriptionList.length} Nifty 50 symbols (Stream Mode)`);

    const runScriptWithIPC = (scriptPath, args = []) => {
      return new Promise((resolve, reject) => {
        const child = fork(scriptPath, args, { stdio: 'inherit' });

        child.on('message', (msg) => {
          if (msg.type === 'metric') {
            try {
              // Direct lookup by key in the metrics object
              const metric = metrics[msg.name];
              if (metric) {
                logger.debug(
                  `📈 IPC Metric Update: ${msg.name} | ${JSON.stringify(msg.labels)} | +${msg.value || 1}`
                );
                if (metric.inc) metric.inc(msg.labels, msg.value || 1);
                else if (metric.set) metric.set(msg.labels, msg.value || 1);
                else if (metric.observe) metric.observe(msg.labels, msg.value || 1);
              } else {
                logger.warn(
                  `⚠️ Metric ${msg.name} not found in parent. Available: ${Object.keys(metrics).join(', ')}`
                );
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

    let isBackfilling = false;

    const updateBackfillStatus = async (status, progress = 0, details = '') => {
      try {
        const statusObj = {
          status, // 0:Idle, 1:Run, 2:Done, 3:Fail
          progress,
          details,
          job_type: 'historical_backfill',
          timestamp: Date.now(),
        };
        await redisClient.set('system:layer1:backfill', JSON.stringify(statusObj));

        // Update Prometheus
        if (status === 1 || status === 'running') {
          metrics.batchJobStatus.set({ job_type: 'historical_backfill' }, 1);
        } else if (status === 2 || status === 'completed') {
          metrics.batchJobStatus.set({ job_type: 'historical_backfill' }, 2);
        } else if (status === 3 || status === 'failed') {
          metrics.batchJobStatus.set({ job_type: 'historical_backfill' }, 3);
        } else {
          metrics.batchJobStatus.set({ job_type: 'historical_backfill' }, 0);
        }

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

    const runBackfill = async (startParams = {}) => {
      if (isBackfilling) {
        logger.warn('⚠️ Backfill already in progress. Skipping...');
        return;
      }
      isBackfilling = true;
      try {
        const startTime = Date.now();
        const { fromDate, toDate, symbol } = startParams;
        const symbolMsg = symbol ? `Symbol: ${symbol}` : 'All Symbols';
        const dateMsg = fromDate && toDate ? `(${fromDate} to ${toDate})` : '(Last 5 Days)';

        await updateBackfillStatus(1, 5, `Starting Backfill... ${symbolMsg} ${dateMsg}`);

        // 1. Clean Data Directory
        // logger.info('🧹 Cleaning up historical data directory...');
        // try {
        //   const fs = require('fs');
        //   const dataDir = path.resolve(__dirname, '../data/historical');
        //   if (fs.existsSync(dataDir)) {
        //      const files = fs.readdirSync(dataDir);
        //      for (const file of files) {
        //        if (file.endsWith('.json')) {
        //          fs.unlinkSync(path.join(dataDir, file));
        //        }
        //      }
        //   }
        // } catch (e) {
        //   logger.warn(`Failed to clean directory: ${e.message}`);
        // }

        // 2. Run Batch Fetch
        logger.info(`⏳ Step 1: Fetching Historical Data... ${symbolMsg} ${dateMsg}`);
        await updateBackfillStatus(1, 10, `Fetching Data... ${symbolMsg}`);

        const batchScript = path.resolve(__dirname, '../scripts/batch_nifty50.js');

        // Construct Arguments based on params
        const scriptArgs = [];
        if (symbol) {
          scriptArgs.push('--symbol', symbol);
        }
        if (fromDate && toDate) {
          scriptArgs.push('--from', fromDate, '--to', toDate);
        } else {
          scriptArgs.push('--days', '5');
        }

        await runScriptWithIPC(batchScript, scriptArgs);

        await updateBackfillStatus(1, 50, 'Step 1 Complete: Data Downloaded');

        // 2. Feed Kafka
        logger.info('⏳ Step 2: Feeding Data to Kafka...');
        await updateBackfillStatus(1, 55, 'Feeding Data to Kafka...');
        const feedScript = path.resolve(__dirname, '../scripts/feed_kafka.js');
        await runScriptWithIPC(feedScript);

        const duration = (Date.now() - startTime) / 1000;
        metrics.batchJobDuration.observe(
          { job_type: 'historical_backfill', status: 'success' },
          duration
        );

        await updateBackfillStatus(2, 100, 'Backfill Complete');
        logger.info('✅ Backfill Complete.');
      } catch (err) {
        await updateBackfillStatus(3, 0, err.message);
        logger.error(`❌ Backfill Failed: ${err.message}`);
      } finally {
        isBackfilling = false;
      }
    };

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

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: Historical Data Sync (if market closed)
    // ═══════════════════════════════════════════════════════════════
    logger.info('');
    logger.info('📋 PHASE 3: Historical Data Synchronization');
    logger.info('─'.repeat(60));

    const skipSync = process.env.SKIP_HISTORICAL_SYNC === 'true';
    const backfillYears = parseInt(process.env.BACKFILL_YEARS || '1', 10);

    if (!marketHours.isMarketOpen()) {
      if (skipSync) {
        logger.info('');
        logger.info('╔════════════════════════════════════════════════════════════╗');
        logger.info('║  🌙 MARKET CLOSED - HISTORICAL SYNC SKIPPED                ║');
        logger.info('║  Reason: SKIP_HISTORICAL_SYNC=true in .env                 ║');
        logger.info('║  To enable: Set SKIP_HISTORICAL_SYNC=false                 ║');
        logger.info('╚════════════════════════════════════════════════════════════╝');
        logger.info('');
        logger.info('📡 Service ready. Waiting for market to open or manual backfill command...');
      } else {
        logger.info('');
        logger.info('╔════════════════════════════════════════════════════════════╗');
        logger.info('║  🌙 MARKET CLOSED - STARTING HISTORICAL DATA BACKFILL      ║');
        logger.info('╚════════════════════════════════════════════════════════════╝');
        logger.info('');

        const currentYear = new Date().getFullYear();
        const yearsToBackfill = [];

        // Build list of years to backfill (most recent first)
        for (let i = 0; i < backfillYears; i++) {
          yearsToBackfill.push(currentYear - i);
        }

        logger.info(`📅 Backfill Strategy: ${backfillYears} year(s) of data`);
        logger.info(`📅 Years to process: ${yearsToBackfill.join(', ')}`);
        logger.info(`📊 Batch size: 1 minute candles, 100 ticks per request`);
        logger.info(`📊 Processing: Day by Day → Month by Month → Year by Year`);
        logger.info('─'.repeat(60));

        let completedYears = 0;
        const totalYears = yearsToBackfill.length;

        for (const year of yearsToBackfill) {
          const yearStartTime = Date.now();
          completedYears++;

          logger.info('');
          logger.info(`╔════════════════════════════════════════════════════════════╗`);
          logger.info(`║  📅 YEAR ${year} - Starting Backfill (${completedYears}/${totalYears})              ║`);
          logger.info(`╚════════════════════════════════════════════════════════════╝`);

          await runBackfill({
            fromDate: `${year}-01-01`,
            toDate: `${year}-12-31`
          });

          const yearDuration = ((Date.now() - yearStartTime) / 1000 / 60).toFixed(1);

          logger.info('');
          logger.info(`╔════════════════════════════════════════════════════════════╗`);
          logger.info(`║  ✅ YEAR ${year} COMPLETE                                    ║`);
          logger.info(`║  Duration: ${yearDuration} minutes                                     ║`);
          logger.info(`║  Progress: ${completedYears}/${totalYears} years completed                          ║`);
          logger.info(`╚════════════════════════════════════════════════════════════╝`);

          // Log to Redis for UI visibility
          await logToRedis(`✅ Year ${year} backfill complete (${completedYears}/${totalYears})`);
        }

        logger.info('');
        logger.info('╔════════════════════════════════════════════════════════════╗');
        logger.info('║  🎉 ALL HISTORICAL BACKFILLS COMPLETE!                     ║');
        logger.info(`║  Total Years Processed: ${totalYears}                                   ║`);
        logger.info('╚════════════════════════════════════════════════════════════╝');
        logger.info('');

        await logToRedis(`🎉 Historical backfill complete! ${totalYears} years of data ingested.`);
      }
    } else {
      logger.info('☀️ Market is OPEN - Skipping historical backfill');
      logger.info('📡 Live data streaming active');
    }
  } catch (error) {
    logger.error('❌ Initialization failed:', error);
    process.exit(1);
  }
}

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

// Metrics endpoint for Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Graceful shutdown
async function shutdown() {
  logger.info('🛑 Shutting down gracefully...');

  if (marketDataVendor) await marketDataVendor.disconnect();
  if (kafkaProducer) await kafkaProducer.disconnect();

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
