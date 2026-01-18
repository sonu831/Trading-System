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

require('dotenv').config();
const express = require('express');
const { VendorFactory } = require('./vendors/factory');
const { KafkaProducer } = require('./kafka/producer');
const { Normalizer } = require('./normalizer');
const { logger } = require('./utils/logger');
const { metrics } = require('./utils/metrics');
const client = require('prom-client');
const symbols = require('../config/symbols.json');

// Initialize Express for health checks
const app = express();
const PORT = process.env.INGESTION_PORT || 3001;

// Prometheus Registry & Metrics
const register = new client.Registry(); // New Prometheus registry
client.collectDefaultMetrics({ register });

const httpRequestDurationMicroseconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5],
});
register.registerMetric(httpRequestDurationMicroseconds);

// Ingestion-specific metrics
const ticksReceivedCounter = new client.Counter({
  name: 'ingestion_ticks_received_total',
  help: 'Total number of ticks received from WebSocket',
  labelNames: ['symbol'],
});
register.registerMetric(ticksReceivedCounter);

const kafkaMessagesSentCounter = new client.Counter({
  name: 'ingestion_kafka_messages_sent_total',
  help: 'Total number of messages sent to Kafka',
  labelNames: ['topic'],
});
register.registerMetric(kafkaMessagesSentCounter);

const websocketConnectionGauge = new client.Gauge({
  name: 'ingestion_websocket_connected',
  help: 'WebSocket connection status (1=connected, 0=disconnected)',
});
register.registerMetric(websocketConnectionGauge);

// Middleware for HTTP request duration
app.use((req, res, next) => {
  const end = httpRequestDurationMicroseconds.startTimer();
  res.on('finish', () => {
    end({ method: req.method, route: req.route ? req.route.path : req.path, code: res.statusCode });
  });
  next();
});

// Initialize components
let marketDataVendor;
let kafkaProducer;
let normalizer;

/**
 * Initialize all services
 */
async function initialize() {
  logger.info('🚀 Starting Layer 1: Data Ingestion Service');

  try {
    // Initialize Kafka Producer
    kafkaProducer = new KafkaProducer({
      brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
      topic: process.env.KAFKA_TOPIC_RAW_TICKS || 'raw-ticks',
    });
    await kafkaProducer.connect();
    logger.info('✅ Kafka Producer connected');

    // Initialize Normalizer
    normalizer = new Normalizer();
    logger.info('✅ Normalizer initialized');

    // Load Subscription List from Global Shared Map
    const path = require('path');
    let subscriptionList = [];
    try {
      const mapPath = path.resolve(__dirname, '../../vendor/nifty50_shared.json');
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

    // Initialize Market Data Vendor via Factory
    marketDataVendor = VendorFactory.createVendor({
      apiKey: process.env.ZERODHA_API_KEY, // Or MStock vars (Env will drive this)
      accessToken: process.env.ZERODHA_ACCESS_TOKEN, // Or MStock vars
      symbols: subscriptionList,
      onTick: handleTick,
    });

    await marketDataVendor.connect();

    logger.info(`🎯 Subscribed to ${subscriptionList.length} Nifty 50 symbols (Stream Mode)`);

    // --- Auto-Switch to Historical Backfill if Market is Closed ---
    const { MarketHours } = require('./utils/market-hours');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    // path already declared above

    const marketHours = new MarketHours();
    if (!marketHours.isMarketOpen()) {
      logger.info('🌙 Market is Closed. Switching to Historical Data Backfill Mode...');

      try {
        // 1. Run Batch Fetch
        logger.info('⏳ Step 1: Fetching Historical Data (Last 5 Days)...');
        const batchScript = path.resolve(__dirname, '../scripts/batch_nifty50.js');
        const { stdout: batchOut, stderr: batchErr } = await execPromise(
          `node ${batchScript} --days 5`
        );
        if (batchOut) logger.info(`Batch Output: ${batchOut}`);
        if (batchErr) logger.warn(`Batch Stderr: ${batchErr}`);

        // 2. Feed Kafka
        logger.info('⏳ Step 2: Feeding Data to Kafka...');
        const feedScript = path.resolve(__dirname, '../scripts/feed_kafka.js');
        const { stdout: feedOut, stderr: feedErr } = await execPromise(`node ${feedScript}`);
        if (feedOut) logger.info(`Feed Output: ${feedOut}`);
        if (feedErr) logger.warn(`Feed Stderr: ${feedErr}`);

        logger.info('✅ Auto-Backfill Complete. Layer 2 should have received historical data.');
      } catch (err) {
        logger.error(`❌ Auto-Backfill Failed: ${err.message}`);
      }
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
