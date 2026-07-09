const logger = require('./utils/logger');

/** Rough ATM weekly premium as a fraction of spot — synthetic/offline seeding ONLY. */
const SYNTHETIC_PREMIUM_FRACTION = 0.008;

/**
 * PaperExecutor — runs the full pipeline for TRADE_MODE=paper and shadow.
 *
 * It does NOT place broker orders. `live` must be handled by a real LiveExecutor
 * (OMS.placeOrder + resting SL-M + fill reconciliation); until that exists this class
 * refuses to run in live mode rather than silently simulating.
 */
class PaperExecutor {
  constructor(config, riskManager, positionManager, strikeSelector, tradeJournal, quoteFeed) {
    if (config.tradeMode === 'live') {
      throw new Error(
        'PaperExecutor cannot run TRADE_MODE=live. A LiveExecutor (OMS orders + resting SL-M) is not implemented yet.'
      );
    }
    this.config = config;
    this.risk = riskManager;
    this.positions = positionManager;
    this.strikeSelector = strikeSelector;
    this.journal = tradeJournal;
    this.quotes = quoteFeed;
    this.tradeMode = config.tradeMode;
  }

  /** The index spot at signal time — used ONLY to pick a strike, never as a price. */
  resolveSpot(signal) {
    const spot = Number(signal.spotPrice ?? signal.spot ?? signal.entryPrice);
    return spot > 0 ? spot : null;
  }

  async executeSignal(signal) {
    // 1. Cheap risk gates first (kill switch, limits, cutoff).
    const openPositions = this.positions.getOpenPositions();
    const gate = await this.risk.canEnter(signal, openPositions);
    if (!gate.allowed) {
      logger.warn({ reason: gate.reason }, `Signal rejected: ${gate.reason}`);
      return null;
    }

    // 2. Resolve the actual option contract from the index spot.
    const spotPrice = this.resolveSpot(signal);
    if (!spotPrice) {
      logger.warn({ signal }, 'Signal rejected: no usable spot price');
      return null;
    }
    const instrument = this.strikeSelector.resolve(signal, spotPrice);
    if (!instrument || !instrument.nfoSymbol) {
      logger.warn('Signal rejected: no instrument resolved');
      return null;
    }

    // 3. Price the ENTRY off the option premium (never the spot).
    const seed = spotPrice * SYNTHETIC_PREMIUM_FRACTION;
    const quote = await this.quotes.primeSymbol(instrument.nfoSymbol, seed);
    // Marketable-limit style: pay the ask when we have a book, else last traded price.
    const entryPremium = Number(quote?.ask) > 0 ? Number(quote.ask) : Number(quote?.ltp);
    if (!(entryPremium > 0)) {
      logger.warn({ symbol: instrument.nfoSymbol }, 'Signal rejected: no option premium available');
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }

    // 4. Size from the real premium. 0 lots => we cannot afford the risk.
    const lots = this.risk.calculateLots(entryPremium, signal);
    if (lots <= 0) {
      logger.warn({ entryPremium, symbol: instrument.nfoSymbol }, 'Signal rejected: insufficient capital for 1 lot');
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }

    // 5. Shadow mode: report the fully-resolved intent, place nothing.
    if (this.tradeMode === 'shadow') {
      logger.info(
        { symbol: instrument.nfoSymbol, entryPremium, lots, direction: signal.direction },
        `SHADOW: would BUY ${lots} lot(s) ${instrument.nfoSymbol} @ ~${entryPremium.toFixed(2)}`
      );
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }

    // 6. Paper fill.
    const position = this.positions.openPosition(signal, lots, entryPremium, instrument);
    this.risk.recordEntry();

    await this.journal.recordTrade({
      ...position,
      broker: 'paper',
      strike: instrument.strike,
      expiry: instrument.expiry,
      optionType: instrument.optionType,
    });
    await this.journal.recordOrder({
      orderId: `paper-${position.id}`,
      tradeId: position.id,
      symbol: instrument.nfoSymbol,
      action: 'BUY',
      orderType: 'LIMIT',
      quantity: lots * position.lotSize,
      price: entryPremium,
      status: 'FILLED',
      broker: 'paper',
    });

    logger.info(
      { id: position.id, symbol: instrument.nfoSymbol, lots, entryPremium },
      'Paper trade executed'
    );
    return position;
  }

  async checkExits() {
    for (const pos of this.positions.getOpenPositions()) {
      const quote = this.quotes.getQuote(pos.nfoSymbol);
      if (quote && quote.ltp > 0) this.positions.updatePrice(pos.id, quote.ltp);

      const exit = this.positions.checkExits(pos);
      if (!exit) continue;

      // Exit at the bid when we have a book (we are selling to close), else last price.
      const exitPrice = Number(quote?.bid) > 0 ? Number(quote.bid) : pos.currentPrice;
      await this.closeAndJournal(pos, exitPrice, exit.reason);
    }
  }

  /** Force-close everything (15:15 square-off, kill switch, shutdown). */
  async squareOffAll(reason = 'square_off') {
    for (const pos of this.positions.getOpenPositions()) {
      const quote = this.quotes.getQuote(pos.nfoSymbol);
      const exitPrice = Number(quote?.bid) > 0 ? Number(quote.bid) : pos.currentPrice;
      await this.closeAndJournal(pos, exitPrice, reason);
    }
  }

  async closeAndJournal(pos, exitPrice, reason) {
    const closed = this.positions.closePosition(pos.id, exitPrice, reason);
    if (!closed) return null;

    try {
      await this.journal.recordTrade(closed);
    } catch (err) {
      logger.error({ err, id: closed.id }, 'Failed to journal exit');
    }

    this.risk.recordTrade(closed); // realised P&L -> daily loss / circuit breaker
    this.quotes.releaseSymbol(closed.nfoSymbol);
    return closed;
  }

  async snapshot() {
    for (const pos of this.positions.getOpenPositions()) {
      const quote = this.quotes.getQuote(pos.nfoSymbol);
      const ltp = quote?.ltp || pos.currentPrice || 0;
      await this.journal.recordPnlSnapshot(pos.id, pos.symbol, ltp, ltp, null, null, null, pos.pnl);
    }
  }
}

module.exports = { PaperExecutor };
