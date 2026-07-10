/**
 * Type declarations for constants.js.
 *
 * constants.js stays plain CommonJS so Docker can `require('/app/shared/constants')`
 * with no build step. This file gives TypeScript the literal types, so
 * `import { KAFKA_TOPICS } from '@shared'` is both type-safe and runtime-correct.
 *
 * Keep the two in sync — a name here that does not exist there resolves to
 * `undefined` at runtime with no type error, which is how a consumer ends up
 * subscribing to topic `undefined`.
 */

export declare const REGIME_TREND: {
  readonly UP: 'TREND_UP';
  readonly DOWN: 'TREND_DOWN';
  readonly RANGE: 'RANGE';
  readonly UNKNOWN: 'UNKNOWN';
};

export declare const REGIME_SENTIMENT: {
  readonly STRONGLY_BULLISH: 'STRONGLY_BULLISH';
  readonly BULLISH: 'BULLISH';
  readonly NEUTRAL: 'NEUTRAL';
  readonly BEARISH: 'BEARISH';
  readonly STRONGLY_BEARISH: 'STRONGLY_BEARISH';
};

export declare const REGIME_VOLATILITY: {
  readonly HIGH: 'HIGH';
  readonly NORMAL: 'NORMAL';
  readonly LOW: 'LOW';
  readonly EXTREME: 'EXTREME';
};

export declare const REGIME_PHASE: {
  readonly TRENDING: 'TRENDING';
  readonly CONSOLIDATING: 'CONSOLIDATING';
  readonly EXHAUSTION: 'EXHAUSTION';
  readonly BREAKOUT: 'BREAKOUT';
};

export declare const SIGNAL_DIRECTION: {
  readonly LONG: 'LONG';
  readonly SHORT: 'SHORT';
};

export declare const SIGNAL_ACTION: {
  readonly BUY: 'BUY';
  readonly SELL: 'SELL';
  readonly HOLD: 'HOLD';
  readonly EXIT: 'EXIT';
  readonly TRAIL: 'TRAIL';
};

/** T1 = scalp (1-5m), T2 = intraday momentum (10-30m), T3 = positional (hours-days). */
export declare const SIGNAL_TIER: {
  readonly T1: 'T1';
  readonly T2: 'T2';
  readonly T3: 'T3';
};

export declare const OPTION_TYPE: {
  readonly CE: 'CE';
  readonly PE: 'PE';
};

export declare const SECTOR_MOMENTUM: {
  readonly STRONG_UP: 'STRONG_UP';
  readonly UP: 'UP';
  readonly NEUTRAL: 'NEUTRAL';
  readonly DOWN: 'DOWN';
  readonly STRONG_DOWN: 'STRONG_DOWN';
};

export declare const TRADE_MODE: {
  readonly PAPER: 'paper';
  readonly SHADOW: 'shadow';
  readonly LIVE: 'live';
};

export declare const PROVIDER_ROLE: {
  readonly DATA: 'data';
  readonly EXECUTION: 'execution';
  readonly BOTH: 'both';
};

export declare const BROKER_BASE_URLS: {
  readonly FLATTRADE: string;
  readonly FLATTRADE_AUTH: string;
  readonly FLATTRADE_PORTAL: string;
  readonly FLATTRADE_WS: string;
  readonly MSTOCK: string;
  readonly KITE: string;
};

/** ISO weekday, 1=Mon..7=Sun. NOT `Date#getDay()` (0=Sun). */
export declare const EXPIRY_WEEKDAY_ISO: {
  readonly NIFTY: number;
  readonly BANKNIFTY: number;
};

export declare const REDIS_KEYS: {
  readonly LTP: (symbol: string) => string;
  readonly CANDLE_LATEST: (symbol: string, tf: string) => string;
  readonly INDICATOR: (symbol: string, indicator: string) => string;
  readonly SENTIMENT: string;
  readonly SIGNAL_LATEST: (symbol: string) => string;
  readonly MARKET_REGIME_LATEST: string;
  readonly MARKET_VIEW: string;
  readonly BROKER_SESSION: (provider: string) => string;
  readonly EXECUTION_PREFIX: string;
  readonly OPTION_CHAIN: (underlying: string) => string;
};

export declare const KAFKA_TOPICS: {
  readonly RAW_TICKS: 'raw-ticks';
  readonly MARKET_CANDLES: 'market_candles';
  readonly ANALYSIS_UPDATES: 'analysis_updates';
  readonly SENTIMENT_SCORES: 'sentiment_scores';
  readonly TRADE_SIGNALS: 'trade-signals';
  readonly NOTIFICATIONS: 'notifications';
  readonly OPTION_CHAIN: 'option-chain';
  readonly MARKET_REGIME: 'market-regime';
  readonly EXECUTION_EVENTS: 'execution-events';
  readonly ALT_DATA: 'alt-data';
  readonly MARKET_DATA: 'market-data';
};

export declare const KAFKA_GROUPS: {
  readonly L2_PROCESSING: string;
  readonly L2_OPTION_CHAIN: string;
  readonly L6_SIGNAL: string;
  readonly L6_REGIME: string;
  readonly L10_EXECUTION: string;
  readonly L8_TELEGRAM: string;
  readonly L8_EMAIL: string;
};

export declare const PORTS: {
  readonly INGESTION: number;
  readonly PROCESSING: number;
  readonly ANALYSIS: number;
  readonly AGGREGATION: number;
  readonly SIGNAL: number;
  readonly BACKEND_API: number;
  readonly EXECUTION: number;
  readonly AI_SERVICE: number;
  readonly DASHBOARD: number;
  readonly GRAFANA: number;
  readonly KAFKA: number;
  readonly KAFKA_UI: number;
  readonly REDIS: number;
  readonly REDIS_COMMANDER: number;
  readonly TIMESCALEDB: number;
  readonly PGADMIN: number;
  readonly PROMETHEUS: number;
  readonly LOKI: number;
  readonly TELEGRAM_BOT: number;
  readonly EMAIL_SERVICE: number;
};
