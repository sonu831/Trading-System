/**
 * PaperExecutor — full pipeline for TRADE_MODE=paper and shadow.
 * Synthetic fills, no broker orders. Refuses live mode.
 */
const logger = require('./utils/logger');
import type { OrderRequest, OrderResult } from './oms/base';

const SYNTHETIC_PREMIUM_FRACTION = 0.008;

interface Signal { id?: string; symbol?: string; direction: string; spotPrice?: number; spot?: number; entryPrice?: number; strategy?: string; tier?: string; params?: Record<string, unknown>; [key: string]: unknown; }

class PaperExecutor {
  config: Record<string, any>; risk: any; positions: any; strikeSelector: any;
  journal: any; quotes: any; tradeMode: string;

  constructor(config: any, risk: any, positions: any, strike: any, journal: any, quotes: any) {
    if (config.tradeMode === 'live') throw new Error('PaperExecutor cannot run TRADE_MODE=live');
    this.config = config; this.risk = risk; this.positions = positions;
    this.strikeSelector = strike; this.journal = journal; this.quotes = quotes;
    this.tradeMode = config.tradeMode;
  }

  resolveSpot(signal: Signal): number | null {
    const spot = Number(signal.spotPrice ?? signal.spot ?? signal.entryPrice);
    return spot > 0 ? spot : null;
  }

  async executeSignal(signal: Signal): Promise<Record<string, unknown> | null> {
    const positions = this.positions.getOpenPositions();
    const gate = await this.risk.canEnter(signal, positions);
    if (!gate.allowed) { logger.warn({ reason: gate.reason }, `rejected: ${gate.reason}`); return null; }

    const spot = this.resolveSpot(signal);
    if (!spot) { logger.warn('no spot'); return null; }

    const instrument = this.strikeSelector.resolve(signal, spot);
    if (!instrument?.nfoSymbol) { logger.warn('no instrument'); return null; }

    const seed = spot * SYNTHETIC_PREMIUM_FRACTION;
    const quote = await this.quotes.primeSymbol(instrument.nfoSymbol, seed);
    const ask = Number(quote?.ask) > 0 ? Number(quote.ask) : Number(quote?.ltp);
    if (!(ask > 0)) return null;

    const lots = this.risk.calculateLots(ask, signal);
    if (lots <= 0) return null;

    const position = this.positions.openPosition(signal, lots, ask, instrument);
    position.synthetic = true;     // Rule 13: paper trades are simulated
    position.source = 'paper';
    if (this.tradeMode !== 'shadow') this.risk.recordEntry();
    await this.journal.recordTrade(position);
    return position;
  }

  async snapshot(): Promise<void> {
    for (const pos of this.positions.getOpenPositions()) {
      const q = this.quotes.getQuote(pos.nfoSymbol);
      const ltp = q?.ltp ?? pos.currentPrice ?? null;
      if (ltp != null) {
        pos.currentPrice = ltp;
        await this.journal.recordPnlSnapshot(pos.id, pos.nfoSymbol, ltp, ltp, null, null, null, pos.pnl);
      }
    }
  }

  /**
   * Mark open positions to the live option premium and exit on the SAME rules live uses.
   *
   * This body used to be empty, and `executeSignal` closed every position at entry with
   * a synthetic `entry * 1.25`, recording that as realised P&L. Every paper trade was a
   * guaranteed +25% winner, so paper mode validated nothing before live. Paper must lose
   * money when the strategy loses money, or it is not a gate.
   */
  async checkExits(): Promise<void> {
    for (const pos of this.positions.getOpenPositions()) {
      const quote = this.quotes.getQuote(pos.nfoSymbol);
      const ltp = Number(quote?.ltp);
      if (!(ltp > 0)) {
        // A missing quote is not a price of zero. Hold the position and say so.
        logger.warn({ id: pos.id, symbol: pos.nfoSymbol }, 'no quote — cannot evaluate exits');
        continue;
      }

      this.positions.updatePrice(pos.id, ltp);
      const decision = this.positions.checkExits(pos);
      if (!decision) continue;

      const closed = this.positions.closePosition(pos.id, ltp, decision.reason);
      if (!closed) continue;
      if (this.tradeMode !== 'shadow') this.risk.recordTrade(closed);
      this.quotes.releaseSymbol(pos.nfoSymbol);
      await this.journal.recordTrade(closed);
      logger.info({ id: closed.id, pnl: closed.pnl, reason: decision.reason }, 'paper position closed');
    }
  }
  async squareOffAll(reason: string): Promise<void> {
    for (const pos of this.positions.getOpenPositions()) { this.positions.closePosition(pos.id, pos.currentPrice, reason); }
  }
}

export = { PaperExecutor };
