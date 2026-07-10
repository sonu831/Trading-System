const express = require('express');
const { Kafka } = require('kafkajs');
const promClient = require('prom-client');
const config = require('../config/default');
const logger = require('./utils/logger');
const { isAtOrAfter, tradingDateIST } = require('./utils/time');
const { FlatTradeOMS } = require('./oms/flattrade');
const { MStockOMS } = require('./oms/mstock');
const { CredentialProvider } = require('./credential-provider');
const { RiskManager } = require('./risk/manager');
const { PositionManager } = require('./risk/position-manager');
const { StrikeSelector } = require('./strike-selector');
const { TradeJournal } = require('./trade-journal');
const { SyntheticQuoteFeed, BrokerQuoteFeed } = require('./quote-feed');
const { PaperExecutor } = require('./paper-executor');
const { LiveExecutor } = require('./live-executor');

const app = express();
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const signalsReceived = new promClient.Counter({ name: 'execution_signals_received_total', help: 'Signals received from Kafka', labelNames: ['strategy', 'action'], registers: [register] });
const ordersPlaced = new promClient.Counter({ name: 'execution_orders_placed_total', help: 'Orders placed', labelNames: ['broker', 'status'], registers: [register] });
const positionsGauge = new promClient.Gauge({ name: 'execution_positions_open', help: 'Open positions', registers: [register] });
const pnlGauge = new promClient.Gauge({ name: 'execution_daily_pnl', help: 'Daily P&L', labelNames: ['type'], registers: [register] });

let oms, riskManager, positionManager, strikeSelector, journal, quoteFeed, executor;
let kafkaConsumer, kafkaProducer, redisClient, redisSubscriber;
let credentialProvider: any;
let reconcileInterval, snapshotInterval, squareOffInterval, dailyResetInterval;
let lastResetDate = null;

async function start() {
  logger.info(`Starting Layer 10: Execution Engine (mode=${config.tradeMode})...`);

  // Start Redis first — credential-provider needs it for session tokens
  await startRedis();

  // Initialize credential provider (fetch from L7 API, subscribe to changes)
  credentialProvider = new CredentialProvider({ redis: redisClient, backendApiUrl: config.backendApiUrl });
  await credentialProvider.init();

  // OMS creation — pass credentialProvider if available, fall back to config
  oms = createOMS();
  riskManager = new RiskManager(config);
  positionManager = new PositionManager(config);
  strikeSelector = new StrikeSelector(config);
  journal = new TradeJournal(config);
  quoteFeed = createQuoteFeed();

  // Wire kill switch persistence (must happen AFTER riskManager is created)
  riskManager.onKillSwitchChange = async (active: boolean) => {
    await redisClient.set(config.redis.keys.killSwitch, active ? '1' : '0');
  };
  const ks = await redisClient.get(config.redis.keys.killSwitch);
  if (ks === '1') riskManager.setKillSwitch(true, 'restored_from_redis');

  // Hot reload: re-create OMS when providers change
  credentialProvider.onProvidersChange(async () => {
    logger.info('Providers changed, re-initializing OMS');
    await oms.disconnect();
    quoteFeed.stop();
    oms = createOMS();
    await oms.connect();
    quoteFeed = createQuoteFeed();
    quoteFeed.start();
  });

  if (config.tradeMode === 'live') {
    // Requires OMS credentials + Kafka producer for execution events
    kafkaProducer = await createKafkaProducer();
    executor = new LiveExecutor(config, riskManager, positionManager, strikeSelector, journal, quoteFeed, oms, kafkaProducer);
    logger.info('LiveExecutor initialized -- broker orders will be placed');
  } else {
    executor = new PaperExecutor(config, riskManager, positionManager, strikeSelector, journal, quoteFeed);
    logger.info('PaperExecutor initialized -- simulating fills');
  }

  await startKafka();
  await startQuoteFeed();

  // Reconcile positions every 5s
  reconcileInterval = setInterval(() => reconcile(), config.oms.reconcileIntervalMs);

  // P&L snapshots every 30s
  snapshotInterval = setInterval(() => executor.snapshot(), 30000);

  // Square-off check every 30s
  squareOffInterval = setInterval(() => { checkSquareOff().catch(err => logger.error({ err }, 'Square-off error')); }, 30000);

  // Daily reset — guard so it fires exactly once per trading date.
  dailyResetInterval = setInterval(() => {
    const today = tradingDateIST();
    if (lastResetDate && lastResetDate !== today) {
      riskManager.resetDaily(today);
      logger.info({ date: today }, 'Daily risk state reset');
    }
    lastResetDate = today;
  }, 60000);
  lastResetDate = tradingDateIST();

  startExpress();

  logger.info(`Layer 10 running | Mode: ${config.tradeMode} | Broker: ${config.broker}`);
}

function createOMS() {
  if (credentialProvider) {
    const active = credentialProvider.getActiveBroker() || config.broker;
    if (active === 'flattrade') return new FlatTradeOMS(config, credentialProvider);
    if (active === 'mstock') return new MStockOMS(config, credentialProvider);
    logger.warn(`Unknown broker ${active}, using FlatTrade`);
    return new FlatTradeOMS(config, credentialProvider);
  }
  // Fallback: read from env config (legacy path for direct env vars)
  if (config.broker === 'flattrade') return new FlatTradeOMS(config);
  if (config.broker === 'mstock') return new MStockOMS(config);
  logger.warn(`Unknown broker ${config.broker}, using FlatTrade`);
  return new FlatTradeOMS(config);
}

function createQuoteFeed() {
  const source = config.quotes.source;
  if (source === 'broker' && oms) return new BrokerQuoteFeed(config, oms);
  return new SyntheticQuoteFeed(config, oms);
}

async function startKafka() {
  const kafka = new Kafka({ clientId: 'execution-engine', brokers: config.kafka.brokers });
  kafkaConsumer = kafka.consumer({ groupId: config.kafka.groupId, sessionTimeout: 30000, heartbeatInterval: 3000 });
  await kafkaConsumer.connect();
  await kafkaConsumer.subscribe({ topic: config.kafka.topics.signals, fromBeginning: false });
  await kafkaConsumer.run({ autoCommit: false, eachMessage: async ({ topic, partition, message }) => {
    try {
      const signal = JSON.parse(message.value.toString());
      signalsReceived.inc({ strategy: signal.strategyId || 'unknown', action: signal.action });
      logger.info({ signal }, 'Signal received');
      await executor.executeSignal(signal);
      await kafkaConsumer.commitOffsets([{ topic, partition, offset: (Number(message.offset) + 1).toString() }]);
    } catch (err) {
      logger.error({ err, offset: message.offset }, 'Failed to process signal — offset NOT committed');
    }
  }});
  logger.info(`Kafka consumer connected, subscribed to ${config.kafka.topics.signals}`);
}

async function createKafkaProducer() {
  const kafka = new Kafka({ clientId: 'execution-engine', brokers: config.kafka.brokers });
  const producer = kafka.producer({ maxInFlightRequests: 1, idempotent: true });
  await producer.connect();
  logger.info('Kafka producer connected for execution-events');
  return producer;
}

async function startRedis() {
  const redis = require('redis');
  redisClient = redis.createClient({ url: config.redis.url });
  redisClient.on('error', (err) => logger.error({ err }, 'Redis error'));
  await redisClient.connect();
  logger.info('Redis connected');

  // Persist the kill switch so a breaker trip (or /kill) survives a restart.
  // NOTE: onKillSwitchChange is wired in start() after riskManager is created.

  // Check kill switch on startup (must happen on the MAIN client, before it subscribes).

  // node-redis v4: a subscribed client cannot run normal commands — use a dedicated connection.
  redisSubscriber = redisClient.duplicate();
  redisSubscriber.on('error', (err) => logger.error({ err }, 'Redis subscriber error'));
  await redisSubscriber.connect();
  await redisSubscriber.subscribe(config.redis.channels.commands, (msg) => {
    try {
      const cmd = JSON.parse(msg);
      if (cmd.command === 'KILL') {
        riskManager.setKillSwitch(true, 'command');
        executor.squareOffAll('kill_switch').catch((err) => logger.error({ err }, 'Kill square-off failed'));
      }
      if (cmd.command === 'RESUME') riskManager.setKillSwitch(false, 'command');
    } catch (e) { logger.error({ err: e }, 'Command parse error'); }
  });
  logger.info('Redis command subscriber connected');
}

async function startQuoteFeed() {
  quoteFeed.start();
}

async function reconcile() {
  try {
    const result = await executor.checkExits();
    positionsGauge.set(positionManager.getOpenPositions().length);

    const state = riskManager.getState();
    pnlGauge.set({ type: 'daily' }, state.dailyState.totalPnl ?? 0);

    // Publish state to Redis
    if (redisClient) {
      await redisClient.set(config.redis.keys.state, JSON.stringify({
        timestamp: new Date().toISOString(),
        mode: config.tradeMode,
        positions: positionManager.getAllPositions().map(p => ({
          id: p.id, symbol: p.symbol, direction: p.direction, lots: p.lots,
          pnl: p.pnl, status: p.status,
        })),
        risk: riskManager.getState(),
      }));

      // Publish notifications to Redis for Layer 8
      const openCount = positionManager.getOpenPositions().length;
      if (openCount > 0) {
        await redisClient.publish(config.redis.channels.notifications || 'notifications:execution', JSON.stringify({
          type: 'execution_update',
          mode: config.tradeMode,
          positions: openCount,
          dailyPnl: riskManager.getState().dailyState?.totalPnl ?? 0,
          killSwitch: riskManager.killSwitch,
          timestamp: new Date().toISOString(),
        }));
      }
    }
  } catch (err) {
    logger.error({ err }, 'Reconcile error');
  }
}

async function checkSquareOff() {
  if (!isAtOrAfter(config.risk.squareOffTime)) return;
  if (positionManager.getOpenPositions().length === 0) return;
  // Go through the executor so exits are journaled and risk state is updated
  // (and, once a LiveExecutor exists, so real broker exit orders are sent).
  await executor.squareOffAll('square_off');
}

function startExpress() {
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({
      status: 'UP', mode: config.tradeMode, broker: config.broker,
      positions: positionManager.getOpenPositions().length,
      killSwitch: riskManager.killSwitch,
    });
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/state', (req, res) => {
    res.json({
      mode: config.tradeMode,
      killSwitch: riskManager.killSwitch,
      positions: positionManager.getAllPositions(),
      risk: riskManager.getState(),
      timestamp: new Date().toISOString(),
    });
  });

  // Halting must also flatten the book — same semantics as the Redis KILL command,
  // otherwise "kill" would silently leave live positions running.
  app.post('/kill', async (req, res) => {
    riskManager.setKillSwitch(true, 'api');
    try {
      await executor.squareOffAll('kill_switch');
    } catch (err) {
      logger.error({ err }, 'Kill square-off failed');
      return res.status(500).json({
        killSwitch: true,
        error: 'Kill switch set, but square-off failed — check positions at the broker',
      });
    }
    res.json({ killSwitch: true, positions: positionManager.getAllPositions() });
  });

  app.post('/resume', (req, res) => {
    riskManager.setKillSwitch(false, 'api');
    res.json({ killSwitch: false });
  });

  app.post('/square-off', async (req, res) => {
    try {
      await executor.squareOffAll('manual_square_off');
      res.json({ killSwitch: riskManager.killSwitch, positions: positionManager.getAllPositions() });
    } catch (err) {
      logger.error({ err }, 'Manual square-off failed');
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(config.service.port, () => {
    logger.info(`Execution API on port ${config.service.port}`);
  });
}

let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down Layer 10...');

  for (const t of [reconcileInterval, snapshotInterval, squareOffInterval, dailyResetInterval]) {
    if (t) clearInterval(t);
  }

  // Stop taking new signals before we touch positions.
  try { if (kafkaConsumer) await kafkaConsumer.disconnect(); } catch (err) { logger.error({ err }, 'Kafka disconnect failed'); }

  // Never leave a position untracked across a restart.
  try {
    const open = positionManager ? positionManager.getOpenPositions() : [];
    if (open.length > 0) {
      logger.warn({ count: open.length }, 'Squaring off open positions before shutdown');
      await executor.squareOffAll('shutdown');
    }
  } catch (err) {
    logger.error({ err }, 'Square-off on shutdown failed — positions may remain open');
  }

  if (quoteFeed) quoteFeed.stop();
  try { if (redisSubscriber) await redisSubscriber.quit(); } catch (_) { /* ignore */ }
  try { if (redisClient) await redisClient.quit(); } catch (_) { /* ignore */ }
  try { if (credentialProvider) await credentialProvider.stop(); } catch (_) { /* ignore */ }
  try { if (journal) await journal.close(); } catch (_) { /* ignore */ }
  try { if (oms) await oms.disconnect(); } catch (_) { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start().catch(err => {
  logger.fatal({ err }, 'Failed to start Layer 10');
  process.exit(1);
});
