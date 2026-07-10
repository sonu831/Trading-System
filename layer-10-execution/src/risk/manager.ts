/**
 * RiskManager — the gate every entry must pass.
 * Two responsibilities: 1) canEnter (cheap checks)  2) calculateLots (sizing from real premium)
 */
const { tradingDateIST, isAtOrAfter } = require('../utils/time');
const logger = require('../utils/logger');

interface RiskConfig {
  maxConcurrentPositions: number; maxTradesPerDay: number; maxDailyLoss: number;
  maxLots: number; capitalAtRisk: number; entryCutoff: string; squareOffTime: string;
}
interface DailyState { tradesToday: number; dailyLoss: number; totalPnl: number; }
interface RiskState { killSwitch: boolean; dailyState: DailyState; maxConcurrent: number; maxTradesPerDay: number; maxDailyLoss: number; entryCutoff: string; squareOff: string; }
interface Signal { params?: { stopLossPct?: number }; [key: string]: unknown; }
interface Position { id?: string; symbol?: string; [key: string]: unknown; }
interface Trade { id?: string; pnl?: number; [key: string]: unknown; }

class RiskManager {
  config: RiskConfig;
  instrument: { lotSize: number };
  strategy: { stopLossPct?: number };
  dailyState: Record<string, DailyState>;
  killSwitch: boolean;
  onKillSwitchChange: ((active: boolean, reason: string) => void) | null;

  constructor(config: any) {
    this.config = config.risk; this.instrument = config.instrument;
    this.strategy = config.strategy || {}; this.dailyState = {};
    this.killSwitch = false; this.onKillSwitchChange = null;
  }

  async canEnter(_signal: Signal, currentPositions: Position[]): Promise<{ allowed: boolean; reason?: string }> {
    if (this.killSwitch) return { allowed: false, reason: 'kill_switch_active' };
    const state = this.getDailyState(tradingDateIST());
    if (currentPositions.length >= this.config.maxConcurrentPositions) return { allowed: false, reason: 'max_concurrent_positions' };
    if (state.tradesToday >= this.config.maxTradesPerDay) return { allowed: false, reason: 'max_trades_per_day' };
    if (isAtOrAfter(this.config.entryCutoff)) return { allowed: false, reason: 'after_entry_cutoff' };
    if (state.dailyLoss >= this.config.maxDailyLoss) { this.setKillSwitch(true, 'max_daily_loss'); return { allowed: false, reason: 'max_daily_loss_hit' }; }
    return { allowed: true };
  }

  calculateLots(entryPremium: number, signal: Signal = {}): number {
    if (!entryPremium || entryPremium <= 0) return 0;
    const lotSize = this.instrument.lotSize;
    const stopLossPct = (signal.params?.stopLossPct ?? this.strategy.stopLossPct ?? 18) as number;
    const riskPerLot = entryPremium * lotSize * (stopLossPct / 100);
    if (riskPerLot <= 0) return 0;
    const fromCapital = Math.floor(this.config.capitalAtRisk / riskPerLot);
    return Math.max(0, Math.min(fromCapital, this.config.maxLots));
  }

  recordEntry(): void { this.getDailyState(tradingDateIST()).tradesToday++; }

  recordTrade(trade: Trade): void {
    const state = this.getDailyState(tradingDateIST());
    const pnl = Number((trade as any)?.pnl);
    if (isNaN(pnl) || (trade as any)?.pnl == null) logger.warn({ tradeId: trade.id }, 'null P&L in risk envelope');
    if (pnl < 0) state.dailyLoss += Math.abs(pnl);
    state.totalPnl += pnl;
    if (state.dailyLoss >= this.config.maxDailyLoss && !this.killSwitch) this.setKillSwitch(true, 'max_daily_loss');
  }

  getDailyState(dateKey: string): DailyState {
    if (!this.dailyState[dateKey]) this.dailyState[dateKey] = { tradesToday: 0, dailyLoss: 0, totalPnl: 0 };
    return this.dailyState[dateKey];
  }

  setKillSwitch(active: boolean, reason = 'manual'): void {
    if (this.killSwitch === active) return;
    this.killSwitch = active;
    logger.warn({ killSwitch: active, reason }, `Kill switch ${active ? 'ACTIVATED' : 'DEACTIVATED'}`);
    if (typeof this.onKillSwitchChange === 'function') Promise.resolve(this.onKillSwitchChange(active, reason)).catch((err: any) => logger.error({ err }, 'Failed to persist kill switch'));
  }

  getState(): RiskState {
    const state = this.getDailyState(tradingDateIST());
    return { killSwitch: this.killSwitch, dailyState: state, maxConcurrent: this.config.maxConcurrentPositions, maxTradesPerDay: this.config.maxTradesPerDay, maxDailyLoss: this.config.maxDailyLoss, entryCutoff: this.config.entryCutoff, squareOff: this.config.squareOffTime };
  }

  resetDaily(dateKey: string): void { this.dailyState[dateKey] = { tradesToday: 0, dailyLoss: 0, totalPnl: 0 }; }
}

export = { RiskManager };
