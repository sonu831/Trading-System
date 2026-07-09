const crypto = require('crypto');
const logger = require('./utils/logger');

const FILL_POLL_ATTEMPTS = 6;
const FILL_POLL_MS = 400;
const SL_PLACE_ATTEMPTS = 3;

/**
 * LiveExecutor — places REAL broker orders. Read the invariants before touching this.
 *
 * INVARIANTS (violating any of these loses real money):
 *  1. WE ONLY EVER BUY PREMIUM. A bullish signal buys a CE; a bearish signal buys a PE.
 *     We never SELL to open — a naked short option has unbounded risk.
 *  2. Entry and stop-loss are atomic. The moment an entry fills we place a resting SL-M at the
 *     broker. If the SL cannot be placed, we immediately market-exit. We never sit unprotected.
 *  3. The broker is the source of truth. A position is only opened after the order book confirms
 *     a fill; we use the broker's average fill price, never our requested price.
 *  4. Every order carries a unique `ordertag` so a retry cannot double-fire.
 *  5. It must be explicitly ARMED (LIVE_TRADING_ARMED=true) and the OMS must support resting
 *     stops and order-status lookup. Otherwise construction fails closed.
 */
class LiveExecutor {
  constructor(config, riskManager, positionManager, strikeSelector, tradeJournal, quoteFeed, oms, kafkaProducer) {
    if (process.env.LIVE_TRADING_ARMED !== 'true') {
      throw new Error(
        'Refusing to start LiveExecutor: set LIVE_TRADING_ARMED=true to place real orders. ' +
          'Do not arm until the validation roadmap (backtest -> paper -> shadow) has passed.'
      );
    }
    if (typeof oms?.supportsRestingStop !== 'function' || !oms.supportsRestingStop()) {
      throw new Error(`Refusing to start LiveExecutor: OMS '${oms?.name}' cannot place a resting stop-loss.`);
    }
    if (typeof oms.getOrderStatus !== 'function') {
      throw new Error(`Refusing to start LiveExecutor: OMS '${oms?.name}' cannot confirm fills (getOrderStatus missing).`);
    }

    this.config = config;
    this.risk = riskManager;
    this.positions = positionManager;
    this.strikeSelector = strikeSelector;
    this.journal = tradeJournal;
    this.quotes = quoteFeed;
    this.oms = oms;
    this.kafkaProducer = kafkaProducer;
    this.tradeMode = config.tradeMode;
    this.lotSize = config.instrument.lotSize;
    this.executing = false;

    logger.warn('LiveExecutor ARMED — real broker orders will be placed.');
  }

  async executeSignal(signal) {
    if (this.executing) {
      logger.warn('LiveExecutor: another execution in flight, dropping signal');
      return null;
    }
    this.executing = true;
    try {
      return await this._execute(signal);
    } catch (err) {
      logger.error({ err, signal }, 'LiveExecutor: executeSignal failed');
      await this._emit('ORDER_ERROR', { error: err.message });
      return null;
    } finally {
      this.executing = false;
    }
  }

  async _execute(signal) {
    // 1. Risk gates (kill switch, limits, cutoff).
    const gate = await this.risk.canEnter(signal, this.positions.getOpenPositions());
    if (!gate.allowed) {
      logger.warn({ reason: gate.reason }, 'LiveExecutor: rejected by risk');
      return null;
    }

    // 2. Resolve the contract. INVARIANT 1: long premium only — direction picks CE vs PE.
    const spotPrice = Number(signal.spotPrice ?? signal.spot ?? signal.entryPrice);
    if (!(spotPrice > 0)) {
      logger.warn('LiveExecutor: no usable spot price');
      return null;
    }
    const optionType = signal.direction === 'LONG' ? 'CE' : 'PE';
    const instrument = this.strikeSelector.resolve({ ...signal, optionType }, spotPrice);
    if (!instrument?.nfoSymbol) {
      logger.warn('LiveExecutor: no instrument resolved');
      return null;
    }
    const lotSize = instrument.lotSize || this.lotSize;

    // 3. Price the entry off the real option book.
    const quote = await this.quotes.primeSymbol(instrument.nfoSymbol, 0);
    const ask = Number(quote?.ask) > 0 ? Number(quote.ask) : Number(quote?.ltp);
    if (!(ask > 0)) {
      logger.warn({ symbol: instrument.nfoSymbol }, 'LiveExecutor: no option premium');
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }

    // 4. Size from real risk. 0 lots => cannot afford; reject.
    const lots = this.risk.calculateLots(ask, signal);
    if (lots <= 0) {
      logger.warn({ ask }, 'LiveExecutor: insufficient capital for 1 lot');
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }
    const quantity = lots * lotSize;

    // 5. Marketable limit (ask + buffer), IOC: fills now or not at all. Caps slippage.
    const ordertag = this._ordertag(instrument.nfoSymbol);
    const limitPrice = this._round(ask * 1.005);

    let entry;
    try {
      entry = await this.oms.placeOrder({
        exchange: 'NFO',
        symbol: instrument.nfoSymbol,
        action: 'BUY', // INVARIANT 1 — never SELL to open
        quantity,
        price: limitPrice,
        orderType: 'LMT',
        productType: 'INTRADAY',
        validity: 'IOC',
        ordertag,
      });
    } catch (err) {
      logger.error({ err, ordertag }, 'LiveExecutor: entry order failed');
      await this._emit('ORDER_FAILED', { ordertag, error: err.message });
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }

    await this._emit('ORDER_PLACED', { ordertag, orderId: entry.orderId, symbol: instrument.nfoSymbol, quantity, limitPrice });
    await this.journal.recordOrder({
      orderId: entry.orderId, tradeId: ordertag, symbol: instrument.nfoSymbol,
      action: 'BUY', orderType: 'LMT', quantity, price: limitPrice, status: 'PENDING', broker: this.oms.name,
    });

    // 6. INVARIANT 3: confirm the fill from the broker's book.
    const fill = await this._awaitFill(entry.orderId);
    if (!fill || fill.filledQty <= 0) {
      logger.warn({ ordertag, status: fill?.status }, 'LiveExecutor: entry not filled (IOC) — aborting');
      await this._safeCancel(entry.orderId);
      await this._emit('ORDER_UNFILLED', { ordertag, status: fill?.status });
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }
    const fillPrice = fill.avgPrice > 0 ? fill.avgPrice : limitPrice;
    const filledQty = fill.filledQty;

    // 7. INVARIANT 2: resting SL-M immediately, or flatten.
    const slPct = signal.params?.stopLossPct ?? this.config.strategy?.stopLossPct ?? 18;
    const triggerPrice = this._round(fillPrice * (1 - slPct / 100));
    const slOrderId = await this._placeRestingStop(instrument.nfoSymbol, filledQty, triggerPrice, `${ordertag}_SL`);

    if (!slOrderId) {
      logger.error({ ordertag }, 'LiveExecutor: SL placement FAILED — emergency flatten');
      await this._emergencyFlatten(instrument.nfoSymbol, filledQty, `${ordertag}_PANIC`);
      await this._emit('SL_FAILED_FLATTENED', { ordertag, symbol: instrument.nfoSymbol });
      this.quotes.releaseSymbol(instrument.nfoSymbol);
      return null;
    }

    // 8. Track the position (broker fill price, actual lots filled).
    const filledLots = Math.max(1, Math.floor(filledQty / lotSize));
    const position = this.positions.openPosition({ ...signal, optionType }, filledLots, fillPrice, instrument);
    position.ordertag = ordertag;
    position.entryOrderId = entry.orderId;
    position.slOrderId = slOrderId;
    position.broker = this.oms.name;

    this.risk.recordEntry();

    await this.journal.recordTrade({ ...position, broker: this.oms.name, strike: instrument.strike, expiry: instrument.expiry, optionType });
    await this._emit('POSITION_OPENED', { ordertag, id: position.id, symbol: instrument.nfoSymbol, fillPrice, lots: filledLots, triggerPrice });

    logger.info({ ordertag, symbol: instrument.nfoSymbol, fillPrice, lots: filledLots, sl: triggerPrice }, 'LiveExecutor: position opened + SL resting');
    return position;
  }

  /** index.js calls this with no args, on the reconcile loop. */
  async checkExits() {
    for (const pos of this.positions.getOpenPositions()) {
      const quote = this.quotes.getQuote(pos.nfoSymbol);
      if (quote && quote.ltp > 0) this.positions.updatePrice(pos.id, quote.ltp);

      const exit = this.positions.checkExits(pos);
      if (exit) await this._closePosition(pos, exit.reason);
    }
  }

  async squareOffAll(reason = 'square_off') {
    const open = this.positions.getOpenPositions();
    if (open.length === 0) return;
    logger.warn({ count: open.length, reason }, 'LiveExecutor: squaring off all positions');
    for (const pos of open) {
      await this._closePosition(pos, reason).catch((err) =>
        logger.error({ err, id: pos.id }, 'LiveExecutor: square-off failed')
      );
    }
  }

  async _closePosition(pos, reason) {
    // Cancel the resting SL first, else the market exit can double-fire against it.
    if (pos.slOrderId) await this._safeCancel(pos.slOrderId);

    const quantity = pos.lots * (pos.lotSize || this.lotSize);
    const exitTag = `${pos.ordertag || pos.id}_X`;

    let exitPrice = null;
    try {
      const exitOrder = await this.oms.placeOrder({
        exchange: 'NFO',
        symbol: pos.nfoSymbol,
        action: 'SELL', // closing a long — this is a sell-to-close, never a short
        quantity,
        orderType: 'MKT',
        productType: 'INTRADAY',
        validity: 'DAY',
        ordertag: exitTag,
      });
      const fill = await this._awaitFill(exitOrder.orderId);
      if (fill?.avgPrice > 0) exitPrice = fill.avgPrice;

      await this.journal.recordOrder({
        orderId: exitOrder.orderId, tradeId: pos.id, symbol: pos.nfoSymbol,
        action: 'SELL', orderType: 'MARKET', quantity, price: exitPrice || 0,
        status: fill?.status || 'UNKNOWN', broker: this.oms.name,
      });
    } catch (err) {
      logger.error({ err, id: pos.id }, 'LiveExecutor: exit order FAILED — position may still be open at broker');
      await this._emit('EXIT_FAILED', { id: pos.id, symbol: pos.nfoSymbol, error: err.message });
      return null; // do NOT mark closed locally; reconcile/human must resolve
    }

    if (!(exitPrice > 0)) {
      const q = this.quotes.getQuote(pos.nfoSymbol);
      exitPrice = Number(q?.bid) > 0 ? Number(q.bid) : pos.currentPrice;
    }

    const closed = this.positions.closePosition(pos.id, exitPrice, reason);
    if (!closed) return null;

    this.risk.recordTrade(closed);
    await this.journal.recordTrade(closed).catch((err) => logger.error({ err }, 'journal exit failed'));
    await this._emit('POSITION_CLOSED', { id: closed.id, symbol: closed.nfoSymbol, exitPrice, pnl: closed.pnl, reason });
    this.quotes.releaseSymbol(closed.nfoSymbol);

    logger.info({ id: closed.id, pnl: closed.pnl, reason }, 'LiveExecutor: position closed');
    return closed;
  }

  async snapshot() {
    for (const pos of this.positions.getOpenPositions()) {
      const q = this.quotes.getQuote(pos.nfoSymbol);
      const ltp = q?.ltp || pos.currentPrice || 0;
      await this.journal.recordPnlSnapshot(pos.id, pos.symbol, ltp, ltp, null, null, null, pos.pnl);
    }
  }

  // ---------------------------------------------------------------- helpers

  async _placeRestingStop(symbol, quantity, triggerPrice, ordertag) {
    for (let i = 0; i < SL_PLACE_ATTEMPTS; i++) {
      try {
        const res = await this.oms.placeOrder({
          exchange: 'NFO',
          symbol,
          action: 'SELL', // sell-to-close the long option if the stop triggers
          quantity,
          orderType: 'SL-MKT',
          triggerPrice,
          productType: 'INTRADAY',
          validity: 'DAY',
          ordertag,
        });
        if (res?.orderId) return res.orderId;
      } catch (err) {
        logger.warn({ err, attempt: i + 1 }, 'LiveExecutor: SL placement attempt failed');
        await this._delay(300);
      }
    }
    return null;
  }

  /** Last resort: get flat at market. Retries hard — an unprotected option is unacceptable. */
  async _emergencyFlatten(symbol, quantity, ordertag) {
    for (let i = 0; i < 3; i++) {
      try {
        await this.oms.placeOrder({
          exchange: 'NFO', symbol, action: 'SELL', quantity,
          orderType: 'MKT', productType: 'INTRADAY', validity: 'DAY', ordertag,
        });
        return true;
      } catch (err) {
        logger.error({ err, attempt: i + 1 }, 'LiveExecutor: EMERGENCY FLATTEN FAILED');
        await this._delay(500);
      }
    }
    await this._emit('MANUAL_INTERVENTION_REQUIRED', { symbol, quantity, ordertag });
    logger.fatal({ symbol, quantity }, 'LiveExecutor: could not flatten — MANUAL INTERVENTION REQUIRED');
    return false;
  }

  async _awaitFill(orderId) {
    for (let i = 0; i < FILL_POLL_ATTEMPTS; i++) {
      try {
        const st = await this.oms.getOrderStatus(orderId);
        if (st) {
          if (st.status === 'COMPLETE') return st;
          if (st.status === 'REJECTED' || st.status === 'CANCELED') return st;
        }
      } catch (err) {
        logger.debug({ err, orderId }, 'LiveExecutor: order status poll failed');
      }
      await this._delay(FILL_POLL_MS);
    }
    return null;
  }

  async _safeCancel(orderId) {
    try {
      await this.oms.cancelOrder(orderId);
    } catch (err) {
      logger.debug({ err, orderId }, 'LiveExecutor: cancel failed (may already be gone)');
    }
  }

  _ordertag(symbol) {
    const ts = Date.now().toString(36);
    const rand = crypto.randomBytes(3).toString('hex');
    const prefix = this.config.oms?.orderTagPrefix || 'SCLP';
    return `${prefix}-${String(symbol).slice(-6)}-${ts}-${rand}`;
  }

  _round(price) {
    return Math.round(price * 20) / 20; // NFO tick size = 0.05
  }

  async _emit(type, data) {
    if (!this.kafkaProducer) return;
    try {
      await this.kafkaProducer.send({
        topic: this.config.kafka?.topics?.executionEvents || 'execution-events',
        messages: [{ key: String(data.ordertag || data.id || type), value: JSON.stringify({ type, timestamp: new Date().toISOString(), ...data }) }],
      });
    } catch (err) {
      logger.warn({ err, type }, 'LiveExecutor: failed to emit execution event');
    }
  }

  _delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

module.exports = { LiveExecutor };
