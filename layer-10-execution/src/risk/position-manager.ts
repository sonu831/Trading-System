/**
 * PositionManager — tracks open option positions.
 *
 * CRITICAL: entryPrice/currentPrice are OPTION PREMIUMS (per unit), not index spot.
 * We are ALWAYS long premium: bullish → CE, bearish → PE.
 * P&L = (exit - entry) × lots × lotSize. Direction does NOT flip the sign.
 */
const logger = require('../utils/logger');

interface Position {
  id: string; strategyId?: string; tier?: string; symbol?: string; direction?: string;
  optionType?: string; action?: string; instrument?: string; nfoSymbol?: string;
  strike?: number; expiry?: string; lotSize: number; lots: number;
  entryTime: string; entryPrice: number; currentPrice: number;
  stopLoss: number; target: number; trailingActive: boolean; trailingSlip: number | null;
  exitPrice?: number; exitTime?: string; exitReason?: string; pnl?: number;
  status: 'OPEN' | 'CLOSED'; ordertag?: string; entryOrderId?: string; slOrderId?: string; broker?: string;
}

class PositionManager {
  config: any; lotSize: number; positions: Map<string, Position>;

  constructor(config: any) { this.config = config; this.lotSize = config.instrument.lotSize; this.positions = new Map(); }

  openPosition(signal: any, lots: number, entryPremium: number, instrument: any = {}): Position {
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const pos: Position = {
      id, strategyId: signal.strategyId, tier: signal.tier, symbol: signal.symbol,
      direction: signal.direction, optionType: instrument.optionType || signal.optionType,
      action: signal.action, instrument: signal.instrument || 'OPTION',
      nfoSymbol: instrument.nfoSymbol, strike: instrument.strike, expiry: instrument.expiry,
      lotSize: instrument.lotSize || this.lotSize, lots, entryTime: new Date().toISOString(),
      entryPrice: entryPremium, currentPrice: entryPremium,
      stopLoss: this.calcStop(entryPremium, signal), target: this.calcTarget(entryPremium, signal),
      trailingActive: false, trailingSlip: null, status: 'OPEN',
    };
    this.positions.set(id, pos);
    logger.info({ id, symbol: pos.symbol, entry: entryPremium, lots, sl: pos.stopLoss }, 'position opened');
    return pos;
  }

  calcStop(entryPremium: number, signal: any): number {
    const pct = (signal.params?.stopLossPct ?? this.config.strategy?.stopLossPct ?? 18) as number;
    return entryPremium * (1 - pct / 100);
  }
  calcTarget(entryPremium: number, signal: any): number {
    const r = (signal.params?.targetR ?? this.config.strategy?.targetR ?? 2.5) as number;
    return entryPremium * (1 + r * (signal.params?.stopLossPct ?? 18) / 100);
  }

  updatePrice(symbol: string, price: number): void {
    for (const pos of this.positions.values()) {
      if (pos.symbol === symbol && pos.status === 'OPEN') {
        pos.currentPrice = price; pos.pnl = (price - pos.entryPrice) * pos.lots * pos.lotSize;
        if (pos.trailingActive && price > pos.entryPrice) {
          const trailPct = (this.config.strategy?.trailingPct ?? 12) as number;
          const newSl = price * (1 - trailPct / 100);
          if (!pos.trailingSlip || newSl > pos.trailingSlip) { pos.trailingSlip = newSl; pos.stopLoss = newSl; }
        }
      }
    }
  }

  closePosition(id: string, exitPrice: number, reason: string): Position | null {
    const pos = this.positions.get(id);
    if (!pos || pos.status !== 'OPEN') return null;
    pos.exitPrice = exitPrice; pos.exitTime = new Date().toISOString(); pos.exitReason = reason; pos.status = 'CLOSED';
    pos.pnl = (exitPrice - pos.entryPrice) * pos.lots * pos.lotSize;
    logger.info({ id, entry: pos.entryPrice, exit: exitPrice, pnl: pos.pnl, reason }, 'position closed');
    return pos;
  }

  getOpenPositions(): Position[] { return [...this.positions.values()].filter(p => p.status === 'OPEN'); }
  getAllPositions(): Position[] { return [...this.positions.values()]; }
}

export = { PositionManager };
