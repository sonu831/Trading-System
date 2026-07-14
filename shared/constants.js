/**
 * Shared Market Constants — RUNTIME (CommonJS, no ts-node required).
 *
 * 🏃 This is what Docker containers load: require('/app/shared/constants')
 * 📝 Source of truth: constants.ts (type-safe, IDE-autocompletable)
 * 🔁 Keep in sync: if you edit one, edit the other
 *
 * Used by: L1, L2, L6, L7, L8 (dashboard), L10 — ALL Node.js layers
 * Go mirror: constants.go
 */

// ── Market Regime ──────────────────────────────────

const REGIME_TREND = {
  UP: 'TREND_UP',
  DOWN: 'TREND_DOWN', 
  RANGE: 'RANGE',
  UNKNOWN: 'UNKNOWN',
};

const REGIME_SENTIMENT = {
  STRONGLY_BULLISH: 'STRONGLY_BULLISH',
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  BEARISH: 'BEARISH',
  STRONGLY_BEARISH: 'STRONGLY_BEARISH',
};

const REGIME_VOLATILITY = {
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
  EXTREME: 'EXTREME',
};

const REGIME_PHASE = {
  TRENDING: 'TRENDING',
  CONSOLIDATING: 'CONSOLIDATING',
  EXHAUSTION: 'EXHAUSTION',
  BREAKOUT: 'BREAKOUT',
};

// ── Signal Types ───────────────────────────────────

const SIGNAL_DIRECTION = {
  LONG: 'LONG',
  SHORT: 'SHORT',
};

const SIGNAL_ACTION = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD',
  EXIT: 'EXIT',
  TRAIL: 'TRAIL',
};

const SIGNAL_TIER = {
  T1: 'T1',       // Scalp (1-5 min)
  T2: 'T2',       // Intraday momentum (10-30 min)
  T3: 'T3',       // Positional (hours-days)
};

// ── Option Types ───────────────────────────────────

const OPTION_TYPE = {
  CE: 'CE',
  PE: 'PE',
};

// ── Sector Momentum ────────────────────────────────

const SECTOR_MOMENTUM = {
  STRONG_UP: 'STRONG_UP',
  UP: 'UP',
  NEUTRAL: 'NEUTRAL',
  DOWN: 'DOWN',
  STRONG_DOWN: 'STRONG_DOWN',
};

// ── Trade Mode ─────────────────────────────────────

const TRADE_MODE = {
  PAPER: 'paper',
  SHADOW: 'shadow',
  LIVE: 'live',
};

// ── Provider Roles ─────────────────────────────────

const PROVIDER_ROLE = {
  DATA: 'data',
  EXECUTION: 'execution',
  BOTH: 'both',
};

// ── Broker credential fields (single source of truth — rule 3/14) ────

const BROKER_CREDENTIAL_FIELDS = ['api_key', 'api_secret', 'client_code', 'password', 'totp_secret', 'access_token'];

// Map provider → which fields are REQUIRED for auth to succeed
const BROKER_REQUIRED_FIELDS = {
  mstock:       ['api_key', 'client_code', 'password'],
  flattrade:    ['api_key', 'api_secret'],
  kite:         ['api_key', 'api_secret'],
  indianapi:    ['api_key'],
};

// Map provider → which fields the dashboard should present in order
const BROKER_FORM_FIELDS = {
  mstock:       ['api_key', 'client_code', 'password', 'totp_secret'],
  flattrade:    ['api_key', 'api_secret', 'access_token'],
  kite:         ['api_key', 'api_secret', 'access_token'],
  indianapi:    ['api_key'],
};

const BROKER_PROVIDERS = [
  { value: 'mstock',    label: 'mStock (Mirae Asset)' },
  { value: 'flattrade', label: 'FlatTrade' },
  { value: 'kite',      label: 'Zerodha Kite' },
  { value: 'indianapi', label: 'IndianAPI' },
];

// ── Broker URLs (single source of truth — rule 3/14) ────
//
// A single source of truth that is WRONG is worse than none: every importer inherits the
// defect. MSTOCK was `api.mstock.in` here while all 8 real call sites — and the official
// Type B docs — use `api.mstock.trade`.

const BROKER_BASE_URLS = {
  FLATTRADE: 'https://piconnect.flattrade.in/PiConnectAPI', // NOT /PiConnectTP, no /REST/
  FLATTRADE_AUTH: 'https://authapi.flattrade.in/trade/apitoken',
  FLATTRADE_PORTAL: 'https://auth.flattrade.in',
  FLATTRADE_WS: 'wss://piconnect.flattrade.in/PiConnectWSAPI', // UNVERIFIED against docs §6
  MSTOCK: 'https://api.mstock.trade', // Type B docs. (`api.mstock.in` does not exist.)
  KITE: 'https://api.kite.trade',
};

// ── Market Hours (single source of truth — rule 3/14) ──
//
// Every layer that checks "is the market open?" uses these values.
// Previously defined in 6+ independent locations with conflicting close times
// (15:00 vs 15:30) and one broken method call (getMarketStatus did not exist).
// Declare ONCE, here. All layers import from shared/.

const MARKET_HOURS = {
  OPEN_HOUR: 9,
  OPEN_MINUTE: 15,
  CLOSE_HOUR: 15,
  CLOSE_MINUTE: 30,
  TIMEZONE: 'Asia/Kolkata',
  IST_OFFSET_MS: 5.5 * 3600000, // 330 minutes
  WEEKEND_DAYS: [0, 6],          // Sunday, Saturday

  // Execution risk gates (deliberately different from market close)
  ENTRY_CUTOFF: '15:00',         // no new trades after
  SQUARE_OFF_TIME: '15:15',      // force-exit all positions

  // API fetch windows
  MIN_API_FETCH_HOURS: [9, 16],  // 9 AM to 4 PM (covers market + pre/post)
};

// ── Weekly expiry weekday (ISO: 1=Mon .. 7=Sun) ─────
//
// ⚠️ OWNER MUST VERIFY against the current NSE circular before live trading.
// This value disagreed across the repo: `layer-10-execution/config/default.js` used 2
// (Tuesday, with its own "verify before going live" warning) while
// `layer-1-ingestion/src/utils/ist-time.js` asserted "NIFTY expires every Thursday" (4).
// Two files, two answers, one of them confidently wrong. Declare it ONCE, here.
//
// NOTE the numbering trap: JS `Date#getDay()` is 0=Sun..6=Sat; luxon `dt.weekday` is
// 1=Mon..7=Sun. Only Sunday differs (0 vs 7) — everything else coincides, which is exactly
// why a mismatch survives casual review. These constants are ISO.

const EXPIRY_WEEKDAY_ISO = {
  NIFTY: Number(process.env.NIFTY_EXPIRY_WEEKDAY_ISO) || 2, // Tuesday
  BANKNIFTY: Number(process.env.BANKNIFTY_EXPIRY_WEEKDAY_ISO) || 2,
};

// ── Redis Key Names ─────────────────────────────────

const REDIS_KEYS = {
  LTP: (symbol) => `ltp:${symbol}`,
  CANDLE_LATEST: (symbol, tf) => `candle:${symbol}:${tf}:latest`,
  INDICATOR: (symbol, indicator) => `indicator:${symbol}:${indicator}`,
  SENTIMENT: 'sentiment:market',
  SIGNAL_LATEST: (symbol) => `signal:${symbol}:latest`,
  MARKET_REGIME_LATEST: 'market-regime:latest',
  MARKET_VIEW: 'market_view',
  BROKER_SESSION: (provider) => `broker:session:${provider}`,
  EXECUTION_PREFIX: 'execution:',
  OPTION_CHAIN: (underlying) => `option-chain:${underlying}`,
  ALERTS_FEED: 'alerts:feed',
  STRATEGIES_CONFIG: 'strategies:config',
  RISK_CONFIG: 'risk:config',
  SYSTEM_COMMANDS: 'system:commands',
  PROVIDERS_CHANGED: 'providers-changed',
  LOGS: 'system:layer1:logs',
  BACKFILL_STATUS: 'system:layer1:backfill',
  SWARM_STATUS: 'system:layer1:swarm_status',
  HEARTBEAT_PREFIX: 'heartbeat:',
};

// ── Redis pub/sub channels (single source of truth — rule 3/14) ──

const REDIS_CHANNELS = {
  TICKS: 'market_ticks',
  SIGNALS: 'signals:trade',              // matches L6 existing publisher
  REGIME: 'market-regime',
  BREADTH: 'market_view',               // matches L5 existing publisher
  OPTION_CHAIN: 'option_chain_updates',
  EXECUTION_STATE: 'execution:state',
  EXECUTION_EVENTS: 'execution-events',
  ALERTS: 'notifications',              // payload carries `source` field
  PROVIDERS_CHANGED: 'providers-changed',
  STRATEGIES_CHANGED: 'strategies-changed',
  RISK_CHANGED: 'risk-changed',
  SYSTEM_COMMANDS: 'system:commands',
  BROKER_SESSION_CHANGED: 'broker-session-changed', // L7 → L1: new session token available
};

// ── Kafka Topic Names (single source of truth — §4) ──

const KAFKA_TOPICS = {
  RAW_TICKS: 'raw-ticks',
  MARKET_CANDLES: 'market_candles',
  ANALYSIS_UPDATES: 'analysis_updates',
  SENTIMENT_SCORES: 'sentiment_scores',
  TRADE_SIGNALS: 'trade-signals',
  NOTIFICATIONS: 'notifications',
  OPTION_CHAIN: 'option-chain',
  MARKET_REGIME: 'market-regime',
  EXECUTION_EVENTS: 'execution-events',
  ALT_DATA: 'alt-data',
  MARKET_DATA: 'market-data',
};

const KAFKA_GROUPS = {
  L2_PROCESSING: 'layer-2-processing-group-v4',
  L2_OPTION_CHAIN: 'layer-2-option-chain-group-v1',
  L6_SIGNAL: 'layer-6-signal-group-v1',
  L6_REGIME: 'layer-6-regime-group-v1',
  L10_EXECUTION: 'layer-10-execution-group-v1',
  L8_TELEGRAM: 'layer-8-telegram-consumer-v1',
  L8_EMAIL: 'layer-8-email-consumer-v1',
};

// ── Port Numbers (single source of truth — §5) ──────

const PORTS = {
  INGESTION: 9101,
  PROCESSING: 3002,
  ANALYSIS: 8081,
  AGGREGATION: 8080,
  SIGNAL: 8082,
  BACKEND_API: 4000,
  EXECUTION: 8095,
  AI_SERVICE: 8000,
  DASHBOARD: 3000,
  GRAFANA: 3001,
  KAFKA: 9092,
  KAFKA_UI: 8090,
  REDIS: 6379,
  REDIS_COMMANDER: 8085,
  TIMESCALEDB: 5432,
  PGADMIN: 5051,
  PROMETHEUS: 9090,
  LOKI: 3100,
  TELEGRAM_BOT: 7000,
  EMAIL_SERVICE: 7001,
};

// ── API auth (L7 gateway) ───────────────────────────
//
// The header every internal caller (dashboard proxy, L1, L10) must present to L7.
// Declared once here because it crosses four layers — a mismatch between the sender and
// the verifier is a silent 401 storm, not a compile error.
//
// L7 previously authenticated ONLY when this header happened to be present, so a request
// that simply omitted it was served unauthenticated — including the endpoint that returns
// DECRYPTED broker credentials. Auth is now default-deny; these are the only open routes.

const API_KEY_HEADER = 'x-api-key';

// Unauthenticated by design: liveness/metrics/docs. Everything else requires a key.
// Matched as exact path or path prefix (`/documentation/...`).
const PUBLIC_API_ROUTES = ['/', '/health', '/metrics', '/documentation', '/swagger', '/api/v1/tv']; 

module.exports = {
  REGIME_TREND, REGIME_SENTIMENT, REGIME_VOLATILITY, REGIME_PHASE,
  SIGNAL_DIRECTION, SIGNAL_ACTION, SIGNAL_TIER, OPTION_TYPE,
  SECTOR_MOMENTUM, TRADE_MODE, PROVIDER_ROLE,
  BROKER_CREDENTIAL_FIELDS, BROKER_REQUIRED_FIELDS, BROKER_FORM_FIELDS, BROKER_PROVIDERS,
  BROKER_BASE_URLS, EXPIRY_WEEKDAY_ISO, REDIS_KEYS, REDIS_CHANNELS, MARKET_HOURS, PORTS,
  KAFKA_TOPICS, KAFKA_GROUPS, API_KEY_HEADER, PUBLIC_API_ROUTES,
};
