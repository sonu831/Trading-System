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

module.exports = {
  REGIME_TREND, REGIME_SENTIMENT, REGIME_VOLATILITY, REGIME_PHASE,
  SIGNAL_DIRECTION, SIGNAL_ACTION, SIGNAL_TIER, OPTION_TYPE,
  SECTOR_MOMENTUM, TRADE_MODE, PROVIDER_ROLE,
  BROKER_BASE_URLS, EXPIRY_WEEKDAY_ISO, REDIS_KEYS, PORTS, KAFKA_TOPICS, KAFKA_GROUPS,
};
