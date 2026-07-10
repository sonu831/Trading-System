/**
 * PositionManager — tracks open option positions and decides when to exit them.
 *
 * CRITICAL SEMANTICS (each of these has been wrong before, in production code):
 *  - `entryPrice` / `currentPrice` are the OPTION PREMIUM (per unit), never the index spot.
 *    Mixing the two produces an instant −99% "stop loss". (Invariant E5.)
 *  - We are ALWAYS long premium: a bullish signal buys a CE, a bearish signal buys a PE.
 *    P&L is therefore always (exit − entry); `direction` does NOT flip its sign. (E1, E6.)
 *  - Rupee P&L multiplies by `lotSize`. Omitting it understates risk ~75×. (E6.)
 *  - `trailingSlip` is a PERCENTAGE of entry premium (a pnlPct level), NOT a price.
 *    A prior rewrite read it as a price and overwrote `stopLoss` with it.
 *
 * This file was gutted by the .js→.ts migration (commit da8b2ca): `checkExits` — the
 * whole exit engine — was deleted, `updatePrice` was re-keyed from positionId to the
 * underlying symbol, and `pnlPct` was never computed. Open positions could never exit.
 * Restored here; `tests/verify-paper.js` asserts every branch.
 */
const logger = require('../utils/logger');

interface Position {
  id: string;
  strategyId?: string;
  tier?: string;
  symbol?: string;
  /** Selects CE vs PE. Does NOT mean buy-vs-sell, and does NOT flip the P&L sign. */
  direction?: string;
  optionType?: string;
  action?: string;
  instrument?: string;

  /** Resolved contract — required for quoting and square-off. */
  nfoSymbol?: string;
  strike?: number;
  expiry?: string;
  lotSize: number;

  lots: number;
  entryTime: string;
  /** Option premium at entry, per unit. Never the index spot. */
  entryPrice: number;
  currentPrice: number;
  /** Premium level. `null` when it cannot be computed — never coerced to 0. */
  stopLoss: number | null;
  target: number | null;
  trailingActive: boolean;
  /** Percentage level (same units as pnlPct), not a price. `null` until activated. */
  trailingSlip: number | null;
  pnl: number;
  pnlPct: number;
  exitPrice?: number;
  exitTime?: string;
  exitReason?: string;
  status: 'OPEN' | 'CLOSED';
  params: Record<string, number | undefined>;
  regime?: unknown;
  reasons: string[];
  ordertag?: string;
  entryOrderId?: string;
  slOrderId?: string;
  broker?: string;
}

interface ExitDecision {
  action: 'EXIT';
  reason: 'stop_loss' | 'target_hit' | 'trailing_stop_hit' | 'time_stop';
}

class PositionManager {
  config: any;
  lotSize: number;
  positions: Map<string, Position>;

  constructor(config: any) {
    this.config = config;
    this.lotSize = config.instrument.lotSize;
    this.positions = new Map();
  }

  /**
   * @param entryPremium option premium at entry (per unit), from the option book — not the spot.
   * @param instrument   resolved by StrikeSelector (nfoSymbol, strike, expiry, lotSize).
   */
  openPosition(signal: any, lots: number, entryPremium: number, instrument: any = {}): Position {
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const position: Position = {
      id,
      strategyId: signal.strategyId,
      tier: signal.tier,
      symbol: signal.symbol,
      direction: signal.direction,
      optionType: instrument.optionType || signal.optionType,
      action: signal.action,
      instrument: signal.instrument || 'OPTION',

      nfoSymbol: instrument.nfoSymbol,
      strike: instrument.strike,
      expiry: instrument.expiry,
      lotSize: instrument.lotSize || this.lotSize,

      lots,
      entryTime: new Date().toISOString(),
      entryPrice: entryPremium,
      currentPrice: entryPremium,
      stopLoss: this.calcStop(entryPremium, signal),
      target: this.calcTarget(entryPremium, signal),
      trailingActive: false,
      trailingSlip: null,
      pnl: 0,
      pnlPct: 0,
      status: 'OPEN',
      params: signal.params || {},
      regime: signal.regime ?? null,
      reasons: signal.reasons || [],
    };
    this.positions.set(id, position);
    logger.info(
      { id, symbol: position.nfoSymbol, direction: position.direction, lots, entryPremium },
      `Position opened: ${id}`,
    );
    return position;
  }

  /** Keyed by positionId, NOT the underlying symbol: two positions can share an underlying. */
  updatePrice(positionId: string, ltp: number): Position | null {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status !== 'OPEN') return null;
    if (!(ltp > 0)) return null; // a 0/NaN quote must not corrupt P&L
    pos.currentPrice = ltp;
    const entry = pos.entryPrice;
    if (!(entry > 0)) return null;
    pos.pnl = (ltp - entry) * pos.lots * pos.lotSize; // long premium, rupee P&L
    pos.pnlPct = ((ltp - entry) / entry) * 100;
    return pos;
  }

  checkExits(position: Position): ExitDecision | null {
    if (!position || position.status !== 'OPEN') return null;

    const pnlPct = position.pnlPct;

    // Hard stop loss (on premium).
    const slPct = position.params?.stopLossPct ?? 18;
    if (pnlPct <= -slPct) return { action: 'EXIT', reason: 'stop_loss' };

    // Target.
    const tgtPct = position.params?.targetPct ?? 25;
    if (pnlPct >= tgtPct) return { action: 'EXIT', reason: 'target_hit' };

    // Trailing stop: once past +trailTrigger, hold a stop `trailStep` below the running peak.
    const trailTrigger = position.params?.trailingTriggerPct ?? 12;
    const trailStep = position.params?.trailingStepPct ?? 6;
    if (pnlPct >= trailTrigger) {
      const candidate = pnlPct - trailStep;
      if (!position.trailingActive) {
        position.trailingActive = true;
        position.trailingSlip = candidate;
        logger.info({ id: position.id, pnlPct, stopAt: candidate }, 'Trailing stop activated');
      } else {
        // Exit only on falling to/below the ratcheted stop — not on any pullback.
        if (position.trailingSlip !== null && pnlPct <= position.trailingSlip) {
          return { action: 'EXIT', reason: 'trailing_stop_hit' };
        }
        position.trailingSlip = Math.max(position.trailingSlip ?? candidate, candidate);
      }
    } else if (position.trailingActive && position.trailingSlip !== null && pnlPct <= position.trailingSlip) {
      // Gave it all back after activating — still honour the stop.
      return { action: 'EXIT', reason: 'trailing_stop_hit' };
    }

    // Time stop: a burst that hasn't worked within N minutes dies to theta.
    const timeStopMin = position.params?.timeStopMinutes ?? 10;
    const elapsed = (Date.now() - new Date(position.entryTime).getTime()) / 60000;
    if (elapsed > timeStopMin && Math.abs(pnlPct) < 5) {
      return { action: 'EXIT', reason: 'time_stop' };
    }

    return null;
  }

  closePosition(positionId: string, exitPrice: number, exitReason: string): Position | null {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status !== 'OPEN') return null;
    pos.status = 'CLOSED';
    pos.exitTime = new Date().toISOString();
    pos.exitPrice = exitPrice;
    pos.exitReason = exitReason;
    if (pos.entryPrice > 0 && exitPrice > 0) {
      pos.pnl = (exitPrice - pos.entryPrice) * pos.lots * pos.lotSize;
      pos.pnlPct = ((exitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    }
    logger.info({ id: positionId, pnl: pos.pnl, reason: exitReason }, `Position closed: ${positionId}`);
    return pos;
  }

  getOpenPositions(): Position[] {
    return [...this.positions.values()].filter((p) => p.status === 'OPEN');
  }

  getPosition(id: string): Position | undefined {
    return this.positions.get(id);
  }

  getAllPositions(): Position[] {
    return [...this.positions.values()];
  }

  /** `null` (not 0) when the premium is unknown: an unknown stop must never read as "stop at zero". */
  calcStop(entryPremium: number, signal: any): number | null {
    const pct = signal.params?.stopLossPct ?? 18;
    return entryPremium > 0 ? entryPremium * (1 - pct / 100) : null;
  }

  calcTarget(entryPremium: number, signal: any): number | null {
    const pct = signal.params?.targetPct ?? 25;
    return entryPremium > 0 ? entryPremium * (1 + pct / 100) : null;
  }
}

export = { PositionManager };
