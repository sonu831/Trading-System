const { tradingDateIST, isAtOrAfter } = require('../utils/time');
const logger = require('../utils/logger');

/**
 * RiskManager — the gate every entry must pass.
 *
 * Two responsibilities, deliberately separated:
 *   1. canEnter()       — cheap boolean gates (kill switch, limits, cutoff). No sizing.
 *   2. calculateLots()  — sizing from the ACTUAL option premium. May return 0 => reject.
 *
 * Sizing note: risk per lot is `premium * lotSize * stopLossPct`, because one lot of a
 * NIFTY option is `lotSize` units of premium. Omitting lotSize understates risk ~75x.
 */
class RiskManager {
  constructor(config) {
    this.config = config.risk;
    this.instrument = config.instrument;
    this.strategy = config.strategy || {};
    this.dailyState = {};
    this.killSwitch = false;
    // Wired by index.js so the breaker survives a restart (persisted to Redis).
    this.onKillSwitchChange = null;
  }

  /** Cheap gates only — no sizing here. */
  async canEnter(signal, currentPositions) {
    if (this.killSwitch) return { allowed: false, reason: 'kill_switch_active' };

    const state = this.getDailyState(tradingDateIST());

    if (currentPositions.length >= this.config.maxConcurrentPositions) {
      return { allowed: false, reason: 'max_concurrent_positions' };
    }

    if (state.tradesToday >= this.config.maxTradesPerDay) {
      return { allowed: false, reason: 'max_trades_per_day' };
    }

    if (isAtOrAfter(this.config.entryCutoff)) {
      return { allowed: false, reason: 'after_entry_cutoff' };
    }

    if (state.dailyLoss >= this.config.maxDailyLoss) {
      this.setKillSwitch(true, 'max_daily_loss');
      return { allowed: false, reason: 'max_daily_loss_hit' };
    }

    return { allowed: true };
  }

  /**
   * Size the position from the real option premium.
   * @param {number} entryPremium - per-unit option premium (NOT the index spot).
   * @returns {number} lots; 0 means "cannot afford risk" => caller must reject.
   */
  calculateLots(entryPremium, signal = {}) {
    if (!entryPremium || entryPremium <= 0) return 0;

    const lotSize = this.instrument.lotSize;
    const stopLossPct =
      signal.params?.stopLossPct ?? this.strategy.stopLossPct ?? 18;

    // Rupee risk if the stop is hit, for ONE lot.
    const riskPerLot = entryPremium * lotSize * (stopLossPct / 100);
    if (riskPerLot <= 0) return 0;

    const lotsFromCapital = Math.floor(this.config.capitalAtRisk / riskPerLot);
    // No Math.max(1, ...): if capital can't cover one lot's risk, we take ZERO.
    return Math.max(0, Math.min(lotsFromCapital, this.config.maxLots));
  }

  /** Count the trade at ENTRY — that is what maxTradesPerDay means. */
  recordEntry() {
    const state = this.getDailyState(tradingDateIST());
    state.tradesToday++;
  }

  /** Record realised P&L at EXIT. Does not touch tradesToday (counted at entry). */
  recordTrade(trade) {
    const state = this.getDailyState(tradingDateIST());
    const pnl = Number(trade?.pnl) || 0;
    if (pnl < 0) state.dailyLoss += Math.abs(pnl);
    state.totalPnl += pnl;

    if (state.dailyLoss >= this.config.maxDailyLoss && !this.killSwitch) {
      this.setKillSwitch(true, 'max_daily_loss');
    }
  }

  getDailyState(dateKey) {
    if (!this.dailyState[dateKey]) {
      this.dailyState[dateKey] = { tradesToday: 0, dailyLoss: 0, totalPnl: 0 };
    }
    return this.dailyState[dateKey];
  }

  setKillSwitch(active, reason = 'manual') {
    if (this.killSwitch === active) return;
    this.killSwitch = active;
    logger.warn({ killSwitch: active, reason }, `Kill switch ${active ? 'ACTIVATED' : 'DEACTIVATED'}`);
    // Persist so a restart cannot silently resume trading after a breaker trip.
    if (typeof this.onKillSwitchChange === 'function') {
      Promise.resolve(this.onKillSwitchChange(active, reason)).catch((err) =>
        logger.error({ err }, 'Failed to persist kill switch')
      );
    }
  }

  getState() {
    const state = this.getDailyState(tradingDateIST());
    return {
      killSwitch: this.killSwitch,
      dailyState: state,
      maxConcurrent: this.config.maxConcurrentPositions,
      maxTradesPerDay: this.config.maxTradesPerDay,
      maxDailyLoss: this.config.maxDailyLoss,
      entryCutoff: this.config.entryCutoff,
      squareOff: this.config.squareOffTime,
    };
  }

  resetDaily(dateKey) {
    this.dailyState[dateKey] = { tradesToday: 0, dailyLoss: 0, totalPnl: 0 };
  }
}

module.exports = { RiskManager };
