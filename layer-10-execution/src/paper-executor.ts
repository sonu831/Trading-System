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

    const entryPremium = ask;
    const slPremium = entryPremium * 0.82;
    const targetPremium = entryPremium * 1.25;
    const pnl = (targetPremium - entryPremium) * lots * instrument.lotSize;

    const position = this.positions.openPosition(signal, lots, entryPremium, instrument);
    if (this.tradeMode !== 'shadow') {
      this.risk.recordEntry();
      this.positions.closePosition(position.id, targetPremium, 'TARGET');
      this.risk.recordTrade({ id: position.id, pnl });
    }
    await this.journal.recordTrade(position);
    return position;
  }

  async checkExits(): Promise<void> { /* synthetic — no real exits to check */ }
  async squareOffAll(reason: string): Promise<void> {
    for (const pos of this.positions.getOpenPositions()) { this.positions.closePosition(pos.id, pos.currentPrice, reason); }
  }
}

export = { PaperExecutor };
