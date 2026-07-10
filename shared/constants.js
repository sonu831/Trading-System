/**
 * Shared Market Constants
 * 
 * Single source of truth for regime, signal, and direction enums.
 * Used by L4 (Go), L5 (Go), L6 (Node.js), L7 (API), L8 (Dashboard).
 * 
 * IMPORT THE APPROPRIATE FORMAT:
 *   Node.js:  const { REGIME } = require('/app/shared/constants');
 *   Go:       import "shared/constants"  (copy constants.go to L4/L5)
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

const BROKER_BASE_URLS = {
  FLATTRADE: 'https://piconnect.flattrade.in/PiConnectAPI',
  FLATTRADE_WS: 'wss://piconnect.flattrade.in/PiConnectWSAPI',
  MSTOCK: 'https://api.mstock.in',
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

module.exports = {
  REGIME_TREND,
  REGIME_SENTIMENT,
  REGIME_VOLATILITY,
  REGIME_PHASE,
  SIGNAL_DIRECTION,
  SIGNAL_ACTION,
  SIGNAL_TIER,
  OPTION_TYPE,
  SECTOR_MOMENTUM,
  TRADE_MODE,
  PROVIDER_ROLE,
  BROKER_BASE_URLS,
  REDIS_KEYS,
};
