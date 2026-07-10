/**
 * Layer 10 (Execution) configuration.
 * Everything is env-overridable; defaults are deliberately conservative.
 *
 * TRADE_MODE governs what actually happens when a signal passes all gates:
 *   paper  — full pipeline, orders simulated against live LTP, journaled as if real (DEFAULT)
 *   shadow — real signals, notification of what WOULD be done; no orders, you fire manually
 *   live   — real orders through EXECUTION_BROKER. Only after weeks of paper + shadow.
 */
require('dotenv').config();

const num = (v, d) => (v !== undefined && v !== '' ? Number(v) : d);
const bool = (v, d) => (v !== undefined && v !== '' ? v === 'true' : d);

module.exports = {
  service: {
    // 8095 everywhere: Dockerfile EXPOSE/HEALTHCHECK, compose `PORT`, and the
    // L7 proxy's EXECUTION_URL default all agree. Changing this breaks all three.
    port: num(process.env.PORT, 8095),
  },

  tradeMode: process.env.TRADE_MODE || 'paper', // paper | shadow | live
  broker: process.env.EXECUTION_BROKER || 'mstock', // mstock | flattrade

  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    groupId: 'execution-layer',
    topics: {
      signals: process.env.KAFKA_TOPIC_TRADE_SIGNALS || 'trade-signals',
    },
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    keys: {
      killSwitch: 'execution:kill_switch', // "1" halts ALL new entries; Telegram /kill sets this
      state: 'execution:state', // published snapshot for dashboard/bot
    },
    channels: {
      commands: 'execution:commands', // {command:'KILL'|'RESUME'} from Telegram bot / dashboard
      notifications: 'notifications:execution', // shadow-mode intents + fills/exits for Layer 8
    },
  },

  timescale: {
    url:
      process.env.TIMESCALE_URL ||
      'postgresql://trading:trading123@localhost:5432/nifty50',
  },

  instrument: {
    underlying: process.env.UNDERLYING || 'NIFTY',
    exchange: 'NFO',
    lotSize: num(process.env.LOT_SIZE, 75),
    strikeStep: num(process.env.STRIKE_STEP, 50),
    // NSE moved NIFTY weekly expiry — verify current weekday before going live.
    // ISO weekday: 1=Mon .. 7=Sun
    expiryWeekday: num(process.env.EXPIRY_WEEKDAY, 2),
    expiryRollAfter: process.env.EXPIRY_ROLL_AFTER || '12:00',
  },

  strike: {
    moneyness: process.env.STRIKE_MONEYNESS || 'ATM', // ATM | ITM1 (better delta for scalps)
    maxSpreadPct: num(process.env.MAX_SPREAD_PCT, 0.5), // reject if bid-ask > 0.5% of premium
    minOpenInterest: num(process.env.MIN_OPEN_INTEREST, 50000),
  },

  strategy: {
    requireConfluence: bool(process.env.REQUIRE_CONFLUENCE, true), // TV signal AND Layer 4 must agree
    confluenceMaxAgeSec: num(process.env.CONFLUENCE_MAX_AGE_SEC, 120),
    stopLossPct: num(process.env.STOP_LOSS_PCT, 18), // % of entry premium
    targetPct: num(process.env.TARGET_PCT, 25),
    trailingTriggerPct: num(process.env.TRAILING_TRIGGER_PCT, 12), // start trailing after +12%
    trailingStepPct: num(process.env.TRAILING_STEP_PCT, 6), // ratchet SL in 6% steps
    timeStopMinutes: num(process.env.TIME_STOP_MINUTES, 10), // stalled scalps die to theta
  },

  risk: {
    maxConcurrentPositions: num(process.env.MAX_CONCURRENT_POSITIONS, 1),
    maxTradesPerDay: num(process.env.MAX_TRADES_PER_DAY, 5),
    maxDailyLoss: num(process.env.MAX_DAILY_LOSS, 2500), // ₹ — circuit breaker flips kill switch
    capitalAtRisk: num(process.env.CAPITAL_AT_RISK, 25000), // ₹ used for lot sizing
    maxLots: num(process.env.MAX_LOTS, 1),
    entryCutoff: process.env.ENTRY_CUTOFF || '15:00', // no new entries after
    squareOffTime: process.env.SQUARE_OFF_TIME || '15:15', // force-exit everything
  },

  oms: {
    reconcileIntervalMs: num(process.env.RECONCILE_INTERVAL_MS, 5000),
    orderTagPrefix: process.env.ORDER_TAG_PREFIX || 'SCLP',
  },

  quotes: {
    // broker: poll executor.getQuote (works read-only in paper mode with creds)
    // synthetic: random-walk for offline dev — NEVER meaningful for live
    source: process.env.QUOTE_SOURCE || (process.env.MSTOCK_API_KEY ? 'broker' : 'synthetic'),
    pollMs: num(process.env.QUOTE_POLL_MS, 1000),
  },

  webhookSecret: process.env.TRADINGVIEW_WEBHOOK_SECRET || '',

  mstock: {
    baseUrl: process.env.MSTOCK_BASE_URL || 'https://api.mstock.trade',
    apiKey: process.env.MSTOCK_API_KEY || '',
    accessToken: process.env.MSTOCK_ACCESS_TOKEN || '',
    clientCode: process.env.MSTOCK_CLIENT_CODE || '',
    // typeb endpoint paths — VERIFY against the MStock Postman collection before live.
    endpoints: {
      placeOrder: '/openapi/typeb/orders/regular',
      modifyOrder: '/openapi/typeb/orders/regular',
      cancelOrder: '/openapi/typeb/orders/regular',
      orderBook: '/openapi/typeb/orders',
      positions: '/openapi/typeb/portfolio/positions',
      quote: '/openapi/typeb/instruments/quote',
      scripMaster: '/openapi/typeb/instruments/scriptmaster',
    },
  },

  flattrade: {
    userId: process.env.FLATTRADE_USER_ID || '',
    accountId: process.env.FLATTRADE_ACTID || '',
    apiKey: process.env.FLATTRADE_API_KEY || '',
    token: process.env.FLATTRADE_TOKEN || '',
    baseUrl: process.env.FLATTRADE_BASE_URL || 'https://piconnect.flattrade.in/PiConnectTP',
  },
};
