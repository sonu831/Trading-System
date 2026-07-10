/**
 * shared/index.js — CommonJS barrel, NO ts-node dependency.
 *
 * Usage:  const { KAFKA_TOPICS, PORTS, REDIS_KEYS } = require('/app/shared');
 *
 * Works in ANY Node.js context — Docker, local dev, scripts, tests.
 * mirrors the exports from constants.ts which is the TypeScript source of truth.
 */

// Load the plain .js runtime constants (always works, no ts-node needed)
const c = require('./constants');

module.exports = {
  // Enums
  REGIME_TREND: c.REGIME_TREND,
  REGIME_SENTIMENT: c.REGIME_SENTIMENT,
  REGIME_VOLATILITY: c.REGIME_VOLATILITY,
  REGIME_PHASE: c.REGIME_PHASE,
  SIGNAL_DIRECTION: c.SIGNAL_DIRECTION,
  SIGNAL_ACTION: c.SIGNAL_ACTION,
  SIGNAL_TIER: c.SIGNAL_TIER,
  OPTION_TYPE: c.OPTION_TYPE,
  SECTOR_MOMENTUM: c.SECTOR_MOMENTUM,
  TRADE_MODE: c.TRADE_MODE,
  PROVIDER_ROLE: c.PROVIDER_ROLE,

  // Infrastructure
  KAFKA_TOPICS: c.KAFKA_TOPICS,
  KAFKA_GROUPS: c.KAFKA_GROUPS,
  PORTS: c.PORTS,
  BROKER_BASE_URLS: c.BROKER_BASE_URLS,
  EXPIRY_WEEKDAY_ISO: c.EXPIRY_WEEKDAY_ISO,
  REDIS_KEYS: c.REDIS_KEYS,
};
