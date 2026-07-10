/**
 * Shared Constants — TYPE-SAFE mirror of constants.js.
 * 💻 IDE/tsc use this. 🏃 Docker uses constants.js.
 * 🔁 Keep in sync: edit both files.
 */
export const REGIME_TREND = { UP: 'TREND_UP', DOWN: 'TREND_DOWN', RANGE: 'RANGE', UNKNOWN: 'UNKNOWN' } as const;
export const KAFKA_TOPICS = { RAW_TICKS: 'raw-ticks', TRADE_SIGNALS: 'trade-signals', OPTION_CHAIN: 'option-chain', MARKET_REGIME: 'market-regime', EXECUTION_EVENTS: 'execution-events', NOTIFICATIONS: 'notifications', ALT_DATA: 'alt-data', MARKET_DATA: 'market-data', MARKET_CANDLES: 'market_candles', ANALYSIS_UPDATES: 'analysis_updates', SENTIMENT_SCORES: 'sentiment_scores' } as const;
export const PORTS = { INGESTION: 9101, PROCESSING: 3002, BACKEND_API: 4000, EXECUTION: 8095, DASHBOARD: 3000, GRAFANA: 3001, KAFKA: 9092, REDIS: 6379, PGADMIN: 5051, TIMESCALEDB: 5432 } as const;
export const REDIS_KEYS = { LTP: (s: string) => `ltp:${s}`, BROKER_SESSION: (p: string) => `broker:session:${p}`, MARKET_REGIME_LATEST: 'market-regime:latest' } as const;
