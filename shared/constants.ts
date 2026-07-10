/**
 * Shared Market Constants — TYPE-SAFE SOURCE OF TRUTH.
 *
 * 💻 This is what IDEs and tsc see: import { KAFKA_TOPICS } from '@shared/constants';
 * 🏃 Runtime: constants.js (CommonJS, no ts-node required — Docker containers load this)
 * 🔁 Keep in sync: if you edit one, edit the other
 * 🐹 Go mirror: constants.go
 */

// ── Market Regime ──────────────────────────────────

export const REGIME_TREND = {
  UP: 'TREND_UP',
  DOWN: 'TREND_DOWN',
  RANGE: 'RANGE',
  UNKNOWN: 'UNKNOWN',
} as const;

export const REGIME_SENTIMENT = {
  STRONGLY_BULLISH: 'STRONGLY_BULLISH',
  BULLISH: 'BULLISH',
  NEUTRAL: 'NEUTRAL',
  BEARISH: 'BEARISH',
  STRONGLY_BEARISH: 'STRONGLY_BEARISH',
} as const;

export const REGIME_VOLATILITY = {
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
  EXTREME: 'EXTREME',
} as const;

export const REGIME_PHASE = {
  TRENDING: 'TRENDING',
  CONSOLIDATING: 'CONSOLIDATING',
  EXHAUSTION: 'EXHAUSTION',
  BREAKOUT: 'BREAKOUT',
} as const;

// ── Signal Types ───────────────────────────────────

export const SIGNAL_DIRECTION = { LONG: 'LONG', SHORT: 'SHORT' } as const;
export const SIGNAL_ACTION = { BUY: 'BUY', SELL: 'SELL', HOLD: 'HOLD', EXIT: 'EXIT', TRAIL: 'TRAIL' } as const;
export const SIGNAL_TIER = { T1: 'T1', T2: 'T2', T3: 'T3' } as const;
export const OPTION_TYPE = { CE: 'CE', PE: 'PE' } as const;

// ── Sector ─────────────────────────────────────────

export const SECTOR_MOMENTUM = {
  STRONG_UP: 'STRONG_UP', UP: 'UP', NEUTRAL: 'NEUTRAL', DOWN: 'DOWN', STRONG_DOWN: 'STRONG_DOWN',
} as const;

// ── Trade Mode ─────────────────────────────────────

export const TRADE_MODE = { PAPER: 'paper', SHADOW: 'shadow', LIVE: 'live' } as const;
export const PROVIDER_ROLE = { DATA: 'data', EXECUTION: 'execution', BOTH: 'both' } as const;

// ── Broker URLs ────────────────────────────────────

export const BROKER_BASE_URLS = {
  FLATTRADE: 'https://piconnect.flattrade.in/PiConnectAPI',
  FLATTRADE_AUTH: 'https://authapi.flattrade.in/trade/apitoken',
  FLATTRADE_PORTAL: 'https://auth.flattrade.in',
  FLATTRADE_WS: 'wss://piconnect.flattrade.in/PiConnectWSAPI',
  MSTOCK: 'https://api.mstock.trade',
  KITE: 'https://api.kite.trade',
} as const;

// ── Expiry ─────────────────────────────────────────

export const EXPIRY_WEEKDAY_ISO = {
  NIFTY: Number(process.env.NIFTY_EXPIRY_WEEKDAY_ISO) || 2,
  BANKNIFTY: Number(process.env.BANKNIFTY_EXPIRY_WEEKDAY_ISO) || 2,
} as const;

// ── Redis Key Names ────────────────────────────────

export const REDIS_KEYS = {
  LTP: (symbol: string) => `ltp:${symbol}`,
  CANDLE_LATEST: (symbol: string, tf: string) => `candle:${symbol}:${tf}:latest`,
  INDICATOR: (symbol: string, indicator: string) => `indicator:${symbol}:${indicator}`,
  SENTIMENT: 'sentiment:market',
  SIGNAL_LATEST: (symbol: string) => `signal:${symbol}:latest`,
  MARKET_REGIME_LATEST: 'market-regime:latest',
  MARKET_VIEW: 'market_view',
  BROKER_SESSION: (provider: string) => `broker:session:${provider}`,
  EXECUTION_PREFIX: 'execution:',
  OPTION_CHAIN: (underlying: string) => `option-chain:${underlying}`,
} as const;

// ── Kafka Topics ───────────────────────────────────

export const KAFKA_TOPICS = {
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
} as const;

// ── Kafka Consumer Groups ──────────────────────────

export const KAFKA_GROUPS = {
  L2_PROCESSING: 'layer-2-processing-group-v4',
  L2_OPTION_CHAIN: 'layer-2-option-chain-group-v1',
  L6_SIGNAL: 'layer-6-signal-group-v1',
  L6_REGIME: 'layer-6-regime-group-v1',
  L10_EXECUTION: 'layer-10-execution-group-v1',
  L8_TELEGRAM: 'layer-8-telegram-consumer-v1',
  L8_EMAIL: 'layer-8-email-consumer-v1',
} as const;

// ── Port Numbers ───────────────────────────────────

export const PORTS = {
  INGESTION: 9101, PROCESSING: 3002, ANALYSIS: 8081, AGGREGATION: 8080,
  SIGNAL: 8082, BACKEND_API: 4000, EXECUTION: 8095, AI_SERVICE: 8000,
  DASHBOARD: 3000, GRAFANA: 3001, KAFKA: 9092, KAFKA_UI: 8090,
  REDIS: 6379, REDIS_COMMANDER: 8085, TIMESCALEDB: 5432, PGADMIN: 5051,
  PROMETHEUS: 9090, LOKI: 3100, TELEGRAM_BOT: 7000, EMAIL_SERVICE: 7001,
} as const;
