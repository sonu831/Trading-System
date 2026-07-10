// ═══════════════════════════════════════════════════════
// shared/types.ts — domain types for the cockpit
// Generated from L7 Fastify JSON schemas (source of truth)
// ═══════════════════════════════════════════════════════

// ── Regime ───────────────────────────────────────────
export type TrendType = 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'UNKNOWN';
export type VolatilityType = 'HIGH' | 'NORMAL' | 'LOW' | 'EXTREME';
export type PhaseType = 'TRENDING' | 'CONSOLIDATING' | 'EXHAUSTION' | 'BREAKOUT';
export type TierType = 'T1' | 'T2' | 'T3';

export interface RegimeState {
  trend: TrendType;
  strength: number;         // 0.0 - 1.0
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

// ── Breadth ──────────────────────────────────────────
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
export type Rupees = number & { readonly __brand: 'INR' };
export type Premium = number & { readonly __brand: 'OPTION_PREMIUM' };
export type SpotPrice = number & { readonly __brand: 'SPOT' };

export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'unreachable'; reason: string }
  | { status: 'stale'; value: T; ageSeconds: number }
  | { status: 'fresh'; value: T };
