/**
 * Layer 1: Data Ingestion Service
 *
 * Connects to market data sources via WebSocket,
 * normalizes data, and publishes to Kafka
 *
 * @author Yogendra Singh
 */

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

    // Initialize Market Data Vendor via Factory
    marketDataVendor = VendorFactory.createVendor({
      apiKey: process.env.ZERODHA_API_KEY,
      accessToken: process.env.ZERODHA_ACCESS_TOKEN,
      symbols: symbols.nifty50,
      onTick: handleTick,
    });

    await marketDataVendor.connect();

    logger.info(`🎯 Subscribed to ${symbols.nifty50.length} Nifty 50 symbols`);
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
app.listen(PORT, () => {
  logger.info(`📡 Health check server running on port ${PORT}`);
  initialize();
});
