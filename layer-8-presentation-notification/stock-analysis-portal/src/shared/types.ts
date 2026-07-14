// ── Market Data ──────────────────────────────────────
export interface IndexQuote {
  symbol?: string;
  ltp: number;
  change?: number;
  changePct?: number;
  open?: number;
  high?: number;
  low?: number;
  prevClose?: number;
  volume?: number;
  timestamp?: string;
}

export interface CandleData {
  time: string | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── Regime ───────────────────────────────────────────
export type TrendType = 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'UNKNOWN';
export type VolatilityType = 'HIGH' | 'NORMAL' | 'LOW' | 'EXTREME';
export type PhaseType = 'TRENDING' | 'CONSOLIDATING' | 'EXHAUSTION' | 'BREAKOUT';
export type TierType = 'T1' | 'T2' | 'T3';

export interface RegimeState {
  trend: TrendType;
  strength: number;
  volatility: VolatilityType;
  phase: PhaseType;
  tfAlignment: Record<string, number>;
  tradeableTiers: TierType[];
  alignmentConfidence: number;
  breadthState?: BreadthState;
  sectorLeaders?: string[];
  confidence: number;
  timestamp: string;
}

export interface BreadthState {
  advancing: number;
  declining: number;
  adRatio: number;
  aboveEma20Pct: number;
  aboveVwapPct: number;
  sentiment: string;
}

// ── Execution ────────────────────────────────────────
export type TradeMode = 'paper' | 'shadow' | 'live';
export type PositionStatus = 'OPEN' | 'CLOSING' | 'CLOSED';
export type Direction = 'LONG' | 'SHORT';
export type OptionType = 'CE' | 'PE';

export interface Position {
  id: string;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  entryTime: string;
  quantity: number;
  lots: number;
  stopLoss: number;
  target: number;
  ltp?: number;
  pnl?: number;
  status: PositionStatus;
  ordertag: string;
}

// ── Signal ───────────────────────────────────────────
export interface TradeSignal {
  id: string;
  underlying: string;
  direction: Direction;
  tier: TierType;
  strategyId: string;
  confidence: number;
  reasons: string[];
  spotPrice: number;
  timestamp: string;
}

// ── Strategy ─────────────────────────────────────────
export interface StrategyConfig {
  id: string;
  name: string;
  enabled: boolean;
  tier: TierType;
  description?: string;
  params: Record<string, unknown>;
  regimeAffinity: string[];
  cooldownMs: number;
  lastTriggeredAt?: string;
}

// ── Option Chain ─────────────────────────────────────
export interface OptionQuote {
  ltp: number;
  bid: number;
  ask: number;
  oi: number;
  vol: number;
  iv: number;
}

export interface ChainRow {
  strike: number;
  isATM: boolean;
  ce: OptionQuote | null;
  pe: OptionQuote | null;
}

// ── Staleness ────────────────────────────────────────
export type StalenessStatus = 'fresh' | 'warning' | 'error' | 'loading';

export interface StalenessResult {
  status: StalenessStatus;
  label: string;
  age?: number;
}

// ── Safety types ─────────────────────────────────────
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'unreachable'; reason: string }
  | { status: 'stale'; value: T; ageSeconds: number }
  | { status: 'fresh'; value: T };

// ── Broker capabilities ────────────────────────────
export interface BrokerCapabilities {
  /** Whether this broker supports placing stop-loss orders on the exchange */
  restingStop: boolean;
  /** Whether this broker supports bracket orders */
  bracketOrders: boolean;
  /** Whether this broker provides live market data streams */
  dataFeed: boolean;
  /** Maximum candles returned per single historical API request */
  maxCandlesPerRequest: number;
  /** Maximum lookback in days for historical intraday data */
  maxHistoricalDays: number;
}

/** Broker capability matrix — used to enforce role/capability rules */
export const BROKER_CAPABILITIES: Record<string, BrokerCapabilities> = {
  mstock: {
    restingStop: false,
    bracketOrders: false,
    dataFeed: true,
    maxCandlesPerRequest: 500,
    maxHistoricalDays: 60,
  },
  flattrade: {
    restingStop: true,
    bracketOrders: true,
    dataFeed: true,
    maxCandlesPerRequest: 1000,
    maxHistoricalDays: 365,
  },
  kite: {
    restingStop: true,
    bracketOrders: true,
    dataFeed: true,
    maxCandlesPerRequest: 1000,
    maxHistoricalDays: 365,
  },
  indianapi: {
    restingStop: false,
    bracketOrders: false,
    dataFeed: true,
    maxCandlesPerRequest: 500,
    maxHistoricalDays: 30,
  },
};
