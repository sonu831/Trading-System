// ═══════════════════════════════════════════════════════
// src/ports/ — interfaces the UI depends on
// Adapters implement these. Organisms never import adapters.
// ═══════════════════════════════════════════════════════

import type { RegimeState, TradeSignal, ChainRow, Position, TradeMode, StalenessResult } from '@/shared/types';

/** Read-only port for execution state — what the cockpit displays. */
export interface ExecutionPort {
  getState(): Promise<{
    mode: TradeMode;
    killSwitch: boolean;
    positions: Position[];
    dailyPnl: number;
    timestamp: string;
  }>;
  kill(): Promise<void>;
  resume(): Promise<void>;
  squareOff(): Promise<void>;
}

/** Read-only port for regime data. */
export interface RegimePort {
  getLatest(): Promise<RegimeState | null>;
  getStaleness(): StalenessResult;
}

/** Read-only port for market data. */
export interface MarketPort {
  getSpot(underlying: string): Promise<number | null>;
  getCandles(underlying: string, timeframe: string, limit?: number): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>>;
}

/** Read-only port for option chain. */
export interface OptionsPort {
  getExpiries(underlying: string): Promise<Array<{ date: string; dte: number; type: string }>>;
  getChain(underlying: string, expiry?: string, strikes?: number): Promise<{ spot: number; atm: number; rows: ChainRow[] }>;
}

/** Read-only port for signals. */
export interface SignalsPort {
  getSignals(tier?: string, limit?: number): Promise<TradeSignal[]>;
}
