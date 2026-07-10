// ═══════════════════════════════════════════════════════════
// shared/ports.ts — interfaces every layer depends on
//
// Adapters implement these. Services consume them.
// Swap a fake adapter for testing — the tree doesn't know or care.
// ═══════════════════════════════════════════════════════════

import type {
  ExecutionState, QuoteResult, OrderResult, Position,
  RegimeState, TradeSignal, ChainRow, OptionAnalytics,
  IndexQuote, CandleData, SessionClock, StrategyConfig,
  StrikePreview, ProviderDetail, ProviderMeta,
  TradeMode, Direction, Loaded,
} from './types';

// ── Broker ──────────────────────────────────────────
export interface BrokerSessionPort {
  testConnection(provider: string): Promise<{ success: boolean; error?: string; stage?: string; token_length?: number }>;
  getCachedToken(provider: string): Promise<string | null>;
  invalidateSession(provider: string): Promise<void>;
}

// ── Execution ───────────────────────────────────────
export interface ExecutionPort {
  getState(): Promise<Loaded<ExecutionState>>;
  getStrikePreview(underlying: string, direction: Direction): Promise<StrikePreview | null>;
  kill(): Promise<void>;
  resume(): Promise<void>;
  squareOff(): Promise<void>;
}

// ── Market Data ─────────────────────────────────────
export interface MarketPort {
  getQuote(underlying: string): Promise<IndexQuote | null>;
  getCandles(underlying: string, tf?: string, limit?: number): Promise<CandleData[]>;
}

// ── Options ─────────────────────────────────────────
export interface OptionsPort {
  getExpiries(underlying: string): Promise<Array<{ date: string; dte: number; type: string }>>;
  getChain(underlying: string, expiry?: string, strikes?: number): Promise<ChainRow[]>;
  getAnalytics(underlying: string): Promise<OptionAnalytics | null>;
}

// ── Regime ──────────────────────────────────────────
export interface RegimePort {
  getLatest(): Promise<RegimeState | null>;
}

// ── Signals ─────────────────────────────────────────
export interface SignalsPort {
  getSignals(tier?: string, limit?: number): Promise<TradeSignal[]>;
}

// ── Providers ───────────────────────────────────────
export interface ProviderPort {
  list(): Promise<ProviderMeta[]>;
  get(id: number): Promise<ProviderDetail | null>;
  create(provider: string, role?: string, priority?: number): Promise<ProviderMeta>;
  update(id: number, data: Partial<ProviderMeta>): Promise<ProviderMeta>;
  enable(id: number): Promise<void>;
  disable(id: number): Promise<void>;
  saveCredential(providerId: number, fieldName: string, value: string): Promise<void>;
  testConnection(provider: string): Promise<{ success: boolean; error?: string }>;
  delete(id: number): Promise<void>;
}

// ── Strategies ──────────────────────────────────────
export interface StrategiesPort {
  list(): Promise<StrategyConfig[]>;
  update(id: string, data: Partial<StrategyConfig>): Promise<StrategyConfig>;
}

// ── Session ─────────────────────────────────────────
export interface SessionPort {
  getClock(): Promise<SessionClock | null>;
}
