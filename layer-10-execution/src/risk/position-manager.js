const logger = require('../utils/logger');

/**
 * PositionManager — tracks open option positions.
 *
 * IMPORTANT SEMANTICS (these were previously wrong and produced nonsense P&L):
 *  - `entryPrice` / `currentPrice` are the OPTION PREMIUM (per unit), never the index spot.
 *  - We are ALWAYS long premium: a bullish signal buys a CE, a bearish signal buys a PE.
 *    So P&L is always (exit - entry); it is NOT sign-flipped by `direction`.
 *  - Rupee P&L must multiply by lotSize (one lot = lotSize units of premium).
 */
class PositionManager {
  constructor(config) {
    this.config = config;
    this.lotSize = config.instrument.lotSize;
    this.positions = new Map();
  }

  /**
   * @param {object} signal      - the trade signal (direction, optionType, params, ...)
   * @param {number} lots
   * @param {number} entryPremium- option premium at entry (per unit)
   * @param {object} instrument  - resolved from StrikeSelector (nfoSymbol, strike, expiry, ...)
   */
  openPosition(signal, lots, entryPremium, instrument = {}) {
    const id = `pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const position = {
      id,
      strategyId: signal.strategyId,
      tier: signal.tier,
      symbol: signal.symbol,
      direction: signal.direction, // drives CE/PE choice, NOT the P&L sign
      optionType: instrument.optionType || signal.optionType,
      action: signal.action,
      instrument: signal.instrument || 'OPTION',

      // resolved contract — required for quoting and square-off
      nfoSymbol: instrument.nfoSymbol,
      strike: instrument.strike,
      expiry: instrument.expiry,
      lotSize: instrument.lotSize || this.lotSize,

      lots,
      entryTime: new Date().toISOString(),
      entryPrice: entryPremium, // OPTION PREMIUM
      currentPrice: entryPremium,
      stopLoss: this.calcStop(entryPremium, signal),
      target: this.calcTarget(entryPremium, signal),
      trailingActive: false,
      trailingSlip: null,
      pnl: 0,
      pnlPct: 0,
      status: 'OPEN',
      params: signal.params || {},
      regime: signal.regime || null,
      reasons: signal.reasons || [],
    };
    this.positions.set(id, position);
    logger.info(
      { id, symbol: position.nfoSymbol, direction: position.direction, lots, entryPremium },
      `Position opened: ${id}`
    );
    return position;
  }

  updatePrice(positionId, ltp) {
    const pos = this.positions.get(positionId);
    if (!pos || pos.status !== 'OPEN') return null;
    if (!(ltp > 0)) return null;
    pos.currentPrice = ltp;
    const entry = pos.entryPrice;
    if (!(entry > 0)) return null;
    pos.pnl = (ltp - entry) * pos.lots * pos.lotSize; // long premium, rupee P&L
    pos.pnlPct = ((ltp - entry) / entry) * 100;
    return pos;
  }

  checkExits(position) {
    if (!position || position.status !== 'OPEN') return null;

    const pnlPct = position.pnlPct;

    // Hard stop loss (on premium)
    const slPct = position.params?.stopLossPct ?? 18;
    if (pnlPct <= -slPct) return { action: 'EXIT', reason: 'stop_loss' };

    // Target
    const tgtPct = position.params?.targetPct ?? 25;
    if (pnlPct >= tgtPct) return { action: 'EXIT', reason: 'target_hit' };

    // Trailing stop: once +trailTrigger, keep a stop `trailStep` below the running peak.
    const trailTrigger = position.params?.trailingTriggerPct ?? 12;
    const trailStep = position.params?.trailingStepPct ?? 6;
    if (pnlPct >= trailTrigger) {
      const candidate = pnlPct - trailStep;
      if (!position.trailingActive) {
        position.trailingActive = true;
        position.trailingSlip = candidate;
        logger.info({ id: position.id, pnlPct, stopAt: candidate }, 'Trailing stop activated');
      } else {
        // Exit only when we fall to/below the ratcheted stop level — not on any pullback.
        if (pnlPct <= position.trailingSlip) {
          return { action: 'EXIT', reason: 'trailing_stop_hit' };
        }
        position.trailingSlip = Math.max(position.trailingSlip, candidate);
      }
    } else if (position.trailingActive && pnlPct <= position.trailingSlip) {
      // Gave everything back after activating — still honour the stop.
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

  closePosition(positionId, exitPrice, exitReason) {
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

  getOpenPositions() {
    return Array.from(this.positions.values()).filter((p) => p.status === 'OPEN');
  }

  getPosition(id) {
    return this.positions.get(id);
  }

  getAllPositions() {
    return Array.from(this.positions.values());
  }

  calcStop(entryPremium, signal) {
    const pct = signal.params?.stopLossPct ?? 18;
    return entryPremium > 0 ? entryPremium * (1 - pct / 100) : null;
  }

  calcTarget(entryPremium, signal) {
    const pct = signal.params?.targetPct ?? 25;
    return entryPremium > 0 ? entryPremium * (1 + pct / 100) : null;
  }
}

module.exports = { PositionManager };
