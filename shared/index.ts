// ═══════════════════════════════════════════════════════════
// shared/index.ts — barrel export
//
// Every layer imports from ONE place:
//   import { REGIME, KAFKA_TOPICS, PORTS, type TradeSignal } from '@shared';
// ═══════════════════════════════════════════════════════════

// Re-export types
export type * from './types';
export type * from './ports';

// Re-export constants (constants.js — plain CommonJS, typed by constants.d.ts).
// Every name constants.js exports must appear here. A name omitted here is not a
// type error; it just makes `import { X } from '@shared'` yield `undefined`.
export {
  REGIME_TREND, REGIME_SENTIMENT, REGIME_VOLATILITY, REGIME_PHASE,
  SIGNAL_DIRECTION, SIGNAL_ACTION, SIGNAL_TIER, OPTION_TYPE,
  SECTOR_MOMENTUM, TRADE_MODE, PROVIDER_ROLE,
  BROKER_BASE_URLS, EXPIRY_WEEKDAY_ISO, REDIS_KEYS,
  PORTS, KAFKA_TOPICS, KAFKA_GROUPS,
} from './constants';
