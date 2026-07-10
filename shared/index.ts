// ═══════════════════════════════════════════════════════════
// shared/index.ts — barrel export
//
// Every layer imports from ONE place:
//   import { REGIME, KAFKA_TOPICS, PORTS, type TradeSignal } from '@shared';
// ═══════════════════════════════════════════════════════════

// Re-export types
export type * from './types';
export type * from './ports';

// Re-export constants (from JS module — interop with existing code)
export {
  REGIME_TREND, REGIME_SENTIMENT, REGIME_VOLATILITY, REGIME_PHASE,
  SIGNAL_DIRECTION, SIGNAL_ACTION, SIGNAL_TIER, OPTION_TYPE,
  SECTOR_MOMENTUM, TRADE_MODE, PROVIDER_ROLE,
  BROKER_BASE_URLS, REDIS_KEYS, PORTS,
} from './constants';
