// ═══════════════════════════════════════════════════════
// src/api/index.ts — typed adapters for API calls
// The ONLY place fetch exists. Organisms never import this.
// ═══════════════════════════════════════════════════════

import type { RegimeState, ChainRow, TradeMode, Position, BreadthState } from '@/shared/types';

const API = '/api/v1';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'API error');
  return json.data as T;
}

// ── Market ────────────────────────────────
export const MarketApi = {
  getIndexQuote: (underlying: string) =>
    get<{ ltp: number; change: number; changePct: number }>(`/market/index/${underlying}/quote`),

  getCandles: (underlying: string, tf = '1m', limit = 200) =>
    get<{ candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }> }>(`/market/index/${underlying}/candles?tf=${tf}&limit=${limit}`),
};

// ── Options ────────────────────────────────
export const OptionsApi = {
  getExpiries: (underlying: string) =>
    get<{ expiries: Array<{ date: string; dte: number; type: string }> }>(`/options/expiries?underlying=${underlying}`),

  getChain: (underlying: string, strikes = 7) =>
    get<{ spot: number; atm: number; rows: ChainRow[] }>(`/options/chain?underlying=${underlying}&strikes=${strikes}`),

  getAnalytics: (underlying: string) =>
    get<{ pcr: number | null; atmIV: number | null }>(`/options/analytics?underlying=${underlying}`),
};

// ── Execution ──────────────────────────────
export const ExecutionApi = {
  getState: () =>
    get<{ mode: TradeMode; killSwitch: boolean; positions: Position[]; dailyPnl: number }>('/execution/state'),

  getStrikePreview: (underlying: string, direction: string) =>
    get<{ nfoSymbol: string; strike: number; premium: number; lots: number; slPrice: number; targetPrice: number; risk: number; reward: number }>(`/execution/strike-preview?underlying=${underlying}&direction=${direction}`),

  kill: () => fetch(`${API}/execution/kill`, { method: 'POST' }),
  resume: () => fetch(`${API}/execution/resume`, { method: 'POST' }),
  squareOff: () => fetch(`${API}/execution/square-off`, { method: 'POST' }),
};

// ── Regime ─────────────────────────────────
export const RegimeApi = {
  getLatest: () => get<RegimeState>('/regime/latest'),
};

// ── Breadth ────────────────────────────────
export const BreadthApi = {
  getLatest: () => get<BreadthState>('/breadth/latest'),
};

// ── Session ────────────────────────────────
export const SessionApi = {
  getClock: () => get<{ marketOpen: boolean; entryCutoff: { minutes: number }; squareOff: { minutes: number } }>('/session/clock'),
};

// ── Strategies ─────────────────────────────
export const StrategiesApi = {
  list: () => get<Array<{ id: string; name: string; tier: string; enabled: boolean; params: Record<string, number> }>>('/strategies'),

  update: (id: string, data: Record<string, unknown>) =>
    fetch(`${API}/strategies/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
};

// ── Risk ───────────────────────────────────
export const RiskApi = {
  getConfig: () => get<Record<string, unknown>>('/risk/config'),
  update: (data: Record<string, unknown>) =>
    fetch(`${API}/risk/config`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
};
