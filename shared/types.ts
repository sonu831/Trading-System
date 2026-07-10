// ═══════════════════════════════════════════════════════════
// shared/types.ts — canonical types for ALL layers
// 
// One source of truth. Every layer imports from here.
// L7 Fastify schemas are the AUTHORITY; this mirrors them.
// ═══════════════════════════════════════════════════════════

// ── Market Regime ───────────────────────────────────
export type TrendType = 'TREND_UP' | 'TREND_DOWN' | 'RANGE' | 'UNKNOWN';
export type SentimentType = 'STRONGLY_BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY_BEARISH';
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
  unchanged: number;
  adRatio: number;
  aboveEma20Pct: number;
  aboveVwapPct: number;
  avgRsi: number;
  sentiment: SentimentType;
}

// ── Execution ───────────────────────────────────────
export type TradeMode = 'paper' | 'shadow' | 'live';
export type PositionStatus = 'OPEN' | 'CLOSING' | 'CLOSED';
export type Direction = 'LONG' | 'SHORT';
export type OptionType = 'CE' | 'PE';
export type OrderType = 'MKT' | 'LMT' | 'SL-MKT' | 'SL-LMT' | 'IOC';
export type ProductType = 'NRML' | 'INTRADAY';
export type ExitReason = 'STOP_LOSS' | 'TARGET' | 'TIME_STOP' | 'SIGNAL' | 'KILL_SWITCH' | 'SQUARE_OFF' | 'END_OF_PERIOD';
export type OrderStatus = 'PENDING' | 'OPEN' | 'COMPLETE' | 'REJECTED' | 'CANCELED';

export interface Position {
  id: string;
  symbol: string;
  nfoSymbol?: string;
  direction: Direction;
  entryPrice: number;
  entryTime: string;
  quantity: number;
  lots: number;
  lotSize: number;
  stopLoss: number;
  target: number;
  ltp?: number;
  pnl?: number;
  pnlPct?: number;
  status: PositionStatus;
  ordertag: string;
  signalId?: string;
  strategy?: string;
  regime?: RegimeState;
  exitReason?: ExitReason;
  exitPrice?: number;
  exitTime?: string;
}

export interface OrderResult {
  orderId: string;
  ordertag: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number | null;
  orderType: OrderType;
  status: OrderStatus;
  raw: unknown;
}

export interface QuoteResult {
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  oi: number | null;
}

export interface ExecutionState {
  mode: TradeMode;
  killSwitch: boolean;
  positions: Position[];
  risk: RiskState;
  timestamp: string;
}

export interface RiskState {
  killSwitch: boolean;
  dailyPnl: number;
  tradesToday: number;
  maxDailyLoss: number;
  maxTradesPerDay: number;
  maxLots: number;
  squareOffTime: string;
}

// ── Signal ───────────────────────────────────────────
export type SignalAction = 'BUY' | 'SELL' | 'HOLD' | 'EXIT' | 'TRAIL';

export interface TradeSignal {
  id: string;
  signalId?: string;
  underlying: string;
  symbol?: string;
  direction: Direction;
  tier: TierType;
  strategyId?: string;
  strategy: string;
  confidence: number;
  reasons: string[];
  spotPrice?: number;
  spot?: number;
  entryPrice?: number;
  action?: SignalAction;
  regime?: RegimeState;
  timestamp: string;
}

// ── Option Chain ─────────────────────────────────────
export interface OptionQuote {
  ltp: number | null;
  bid: number | null;
  ask: number | null;
  oi: number | null;
  vol: number | null;
  iv: number | null;
}

export interface ChainRow {
  strike: number;
  isATM: boolean;
  ce: OptionQuote | null;
  pe: OptionQuote | null;
}

export interface OptionChainData {
  underlying: string;
  spot: number | null;
  atm: number;
  expiry?: string;
  rows: ChainRow[];
}

export interface OptionAnalytics {
  underlying: string;
  pcr: number | null;
  atmIV: number | null;
  totalCEOI?: number;
  totalPEOI?: number;
  maxPain?: number | null;
  timestamp?: string;
}

// ── Provider / Broker ────────────────────────────────
export type ProviderName = 'mstock' | 'flattrade' | 'kite' | 'indianapi';
export type ProviderRole = 'data' | 'execution' | 'both';
export type SessionStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'DISABLED' | 'NOT_CONFIGURED';

export interface ProviderMeta {
  id: number;
  provider: ProviderName;
  enabled: boolean;
  role: ProviderRole;
  priority: number;
  status: SessionStatus;
  last_tested_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CredentialField {
  field_name: string;
  value: string;
  is_active: boolean;
}

export interface ProviderDetail extends ProviderMeta {
  credentials: CredentialField[];
}

// ── Safety types (branded for compile-time safety) ──
export type Rupees = number & { readonly __brand: 'INR' };
export type Premium = number & { readonly __brand: 'OPTION_PREMIUM' };
export type SpotPrice = number & { readonly __brand: 'SPOT' };

// ── Staleness ────────────────────────────────────────
export type StalenessLevel = 'fresh' | 'warning' | 'error' | 'loading';

export interface StalenessResult {
  status: StalenessLevel;
  label: string;
  age?: number;
}

// ── Loaded<T> discriminated union ───────────────────
export type Loaded<T> =
  | { status: 'loading' }
  | { status: 'unreachable'; reason: string }
  | { status: 'stale'; value: T; ageSeconds: number }
  | { status: 'fresh'; value: T };

// ── API Response wrapper ─────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// ── Market Data ─────────────────────────────────────
export interface IndexQuote {
  underlying: string;
  ltp: number | null;
  change: number | null;
  changePct: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  vwap: number | null;
  atr: number | null;
  volume: number;
  timestamp: number;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SessionClock {
  marketOpen: boolean;
  isWeekend: boolean;
  entryCutoff: { hours: number; minutes: number; totalMinutes: number };
  squareOff: { hours: number; minutes: number; totalMinutes: number };
  serverTime: string;
}

// ── Strategy ─────────────────────────────────────────
export interface StrategyConfig {
  id: string;
  name: string;
  tier: TierType;
  description: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
}

// ── Strike Preview ──────────────────────────────────
export interface StrikePreview {
  underlying: string;
  direction: Direction;
  spot: number;
  atm: number;
  strike: number;
  moneyness: string;
  nfoSymbol: string;
  optionType: OptionType;
  expiry: string;
  premium: number;
  lots: number;
  quantity: number;
  lotSize: number;
  slPrice: number;
  targetPrice: number;
  risk: number;
  reward: number;
  riskReward: number;
}
