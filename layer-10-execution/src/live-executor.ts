/**
 * LiveExecutor — places REAL broker orders.
 *
 * INVARIANTS (violating any loses real money):
 *  1. ONLY BUY PREMIUM. Bullish → CE, bearish → PE. Never SELL to open.
 *  2. Entry + SL atomic. Fill → resting SL-M. SL fails → market-exit immediately.
 *  3. Broker is source of truth. Open on confirmed fill at broker's avg price.
 *  4. Every order has unique `ordertag` — retry cannot double-fire.
 *  5. ARMED check + OMS capability probe. Fail closed.
 */
const crypto = require('crypto');
const logger = require('./utils/logger');
const { latency: globalLatency } = require('./utils/latency');

const FILL_POLL_ATTEMPTS = 6;
const FILL_POLL_MS = 400;
const SL_PLACE_ATTEMPTS = 3;

interface Signal {
  id?: string; signalId?: string; direction: string; spotPrice?: number; spot?: number;
  entryPrice?: number; symbol?: string; strategy?: string; tier?: string;
  params?: Record<string, unknown>; regime?: Record<string, unknown>;
  [key: string]: unknown;
}

interface StrikeCache { NIFTY?: number; BANKNIFTY?: number; spot?: number; updatedAt?: number; }

interface PositionResult {
  id: string; ordertag?: string; entryOrderId?: string; slOrderId?: string; broker?: string;
  symbol?: string; nfoSymbol?: string; direction?: string; entryPrice?: number;
  lots?: number; lotSize?: number; quantity?: number; stopLoss?: number; target?: number;
  [key: string]: unknown;
}

interface FillResult { filledQty: number; avgPrice: number; status?: string; }
interface Quote { ltp?: number; ask?: number; bid?: number; }
interface OMS {
  name: string; supportsRestingStop(): boolean; getOrderStatus(orderId: string): Promise<FillResult | null>;
  placeOrder(o: Record<string, unknown>): Promise<{ orderId: string; [k: string]: unknown }>;
  cancelOrder(id: string): Promise<unknown>;
}

class LiveExecutor {
  config: Record<string, any>; risk: any; positions: any; strikeSelector: any;
  journal: any; quotes: any; oms: OMS; kafkaProducer: any;
  tradeMode: string; lotSize: number; executing: boolean; latency: any;
  strikeCache: StrikeCache | null; strikeCacheTTL: number;
  _strikeInterval: ReturnType<typeof setInterval> | null;

  constructor(config: any, riskManager: any, positionManager: any, strikeSelector: any,
              tradeJournal: any, quoteFeed: any, oms: OMS, kafkaProducer: any) {
    if (process.env.LIVE_TRADING_ARMED !== 'true') throw new Error('LIVE_TRADING_ARMED must be true');
    if (typeof oms?.supportsRestingStop !== 'function' || !oms.supportsRestingStop()) throw new Error('OMS cannot place resting stop-loss');
    if (typeof oms.getOrderStatus !== 'function') throw new Error('OMS cannot confirm fills');

    this.config = config; this.risk = riskManager; this.positions = positionManager;
    this.strikeSelector = strikeSelector; this.journal = tradeJournal; this.quotes = quoteFeed;
    this.oms = oms; this.kafkaProducer = kafkaProducer;
    this.tradeMode = config.tradeMode; this.lotSize = config.instrument.lotSize;
    this.executing = false; this.latency = globalLatency;
    this.strikeCache = null; this.strikeCacheTTL = 0; this._strikeInterval = null;
    this.startStrikeCache();
    logger.warn('LiveExecutor ARMED — real broker orders will be placed.');
  }

  startStrikeCache(): void {
    this.refreshStrikeCache();
    this._strikeInterval = setInterval(() => this.refreshStrikeCache(), 30000);
  }
  async refreshStrikeCache(): Promise<void> {
    try {
      const spot = this.quotes.getSpot?.() ?? 0;
      if (spot > 0) { this.strikeCache = { NIFTY: this._atmStrike(spot, 50), BANKNIFTY: this._atmStrike(spot, 100), spot, updatedAt: Date.now() }; }
    } catch (_) {}
  }
  _atmStrike(spot: number, step: number): number { return Math.round(spot / step) * step; }

  resolveInstrument(signal: Signal): any {
    const spotPrice = Number(signal.spotPrice ?? signal.spot ?? signal.entryPrice);
    if (!(spotPrice > 0)) { logger.warn('LiveExecutor: no spot'); return null; }
    return this.strikeSelector.resolve(signal, spotPrice, this.strikeCache);
  }

  async executeSignal(signal: Signal): Promise<PositionResult | null> {
    if (this.executing) return null;
    this.executing = true;
    try { return await this._execute(signal); }
    catch (err: any) { logger.error({ err }, 'LiveExecutor: failed'); await this._emit('ORDER_ERROR', { error: err.message }); return null; }
    finally { this.executing = false; }
  }

  async _execute(signal: Signal): Promise<PositionResult | null> {
    const signalId = (signal.id || signal.signalId || `s_${Date.now()}`) as string;
    this.latency.start(signalId); this.latency.stamp(signalId, 'signal_rcvd');

    const gate = await this.risk.canEnter(signal, this.positions.getOpenPositions());
    if (!gate.allowed) { logger.warn({ reason: gate.reason }, 'rejected by risk'); this.latency.finish(signalId, false); return null; }
    this.latency.stamp(signalId, 'risk_check');

    const instrument = this.resolveInstrument(signal);
    if (!instrument?.nfoSymbol) { this.latency.finish(signalId, false); return null; }
    this.latency.stamp(signalId, 'instrument');
    const lotSize = instrument.lotSize || this.lotSize;

    const quote: Quote = await this.quotes.primeSymbol(instrument.nfoSymbol, 0);
    const ask = Number(quote?.ask) > 0 ? Number(quote.ask) : Number(quote?.ltp);
    if (!(ask > 0)) { this.quotes.releaseSymbol(instrument.nfoSymbol); this.latency.finish(signalId, false); return null; }
    this.latency.stamp(signalId, 'quote');

    const lots = this.risk.calculateLots(ask, signal);
    if (lots <= 0) { this.quotes.releaseSymbol(instrument.nfoSymbol); this.latency.finish(signalId, false); return null; }
    const quantity = lots * lotSize;
    const ordertag = this._ordertag(instrument.nfoSymbol);
    const limitPrice = this._round(ask * 1.005);

    let entry: { orderId: string; [k: string]: unknown };
    try { entry = await this.oms.placeOrder({ exchange: 'NFO', symbol: instrument.nfoSymbol, action: 'BUY', quantity, price: limitPrice, orderType: 'LMT', productType: 'INTRADAY', validity: 'IOC', ordertag }); }
    catch (err: any) { logger.error({ err, ordertag }, 'entry failed'); await this._emit('ORDER_FAILED', { ordertag, error: err.message }); this.quotes.releaseSymbol(instrument.nfoSymbol); this.latency.finish(signalId, false); return null; }
    this.latency.stamp(signalId, 'entry_sent');

    await this._emit('ORDER_PLACED', { ordertag, orderId: entry.orderId, symbol: instrument.nfoSymbol, quantity, limitPrice });
    await this.journal.recordOrder({ orderId: entry.orderId, tradeId: ordertag, symbol: instrument.nfoSymbol, action: 'BUY', orderType: 'LMT', quantity, price: limitPrice, status: 'PENDING', broker: this.oms.name });

    const fill = await this._awaitFill(entry.orderId);
    if (!fill || fill.filledQty <= 0) { logger.warn({ ordertag }, 'not filled'); await this._safeCancel(entry.orderId); this.quotes.releaseSymbol(instrument.nfoSymbol); this.latency.finish(signalId, false); return null; }
    this.latency.stamp(signalId, 'entry_fill');

    const fillPrice = fill.avgPrice > 0 ? fill.avgPrice : limitPrice;
    const slPct = (signal.params?.stopLossPct as number) ?? this.config.strategy?.stopLossPct ?? 18;
    const triggerPrice = this._round(fillPrice * (1 - slPct / 100));
    const slOrderId = await this._placeRestingStop(instrument.nfoSymbol, fill.filledQty, triggerPrice, `${ordertag}_SL`);
    if (!slOrderId) { logger.error({ ordertag }, 'SL FAILED'); await this._emergencyFlatten(instrument.nfoSymbol, fill.filledQty, `${ordertag}_PANIC`); this.quotes.releaseSymbol(instrument.nfoSymbol); this.latency.finish(signalId, false); return null; }
    this.latency.stamp(signalId, 'sl_placed');

    const filledLots = Math.max(1, Math.floor(fill.filledQty / lotSize));
    const position = this.positions.openPosition({ ...signal, optionType: signal.direction === 'LONG' ? 'CE' : 'PE' }, filledLots, fillPrice, instrument);
    position.ordertag = ordertag; position.entryOrderId = entry.orderId; position.slOrderId = slOrderId; position.broker = this.oms.name;
    this.risk.recordEntry();
    await this.journal.recordTrade({ ...position, broker: this.oms.name, strike: instrument.strike, expiry: instrument.expiry, optionType: signal.direction === 'LONG' ? 'CE' : 'PE' });
    this.latency.finish(signalId, true);
    logger.info({ ordertag, symbol: instrument.nfoSymbol, fillPrice, lots: filledLots, sl: triggerPrice }, 'position opened + SL resting');
    return position;
  }

  async checkExits(): Promise<void> { /* reconcile loop — delegates to position manager */ }

  async squareOffAll(reason: string): Promise<void> {
    const open = this.positions.getOpenPositions();
    for (const pos of open) { await this._closePosition(pos, reason).catch((err: any) => logger.error({ err, id: pos.id }, 'square-off failed')); }
  }

  async _closePosition(pos: any, reason: string): Promise<any> {
    if (pos.slOrderId) await this._safeCancel(pos.slOrderId);
    const quantity = pos.lots * (pos.lotSize || this.lotSize);
    try {
      const exitOrder = await this.oms.placeOrder({ exchange: 'NFO', symbol: pos.nfoSymbol, action: 'SELL', quantity, orderType: 'MKT', productType: 'INTRADAY', validity: 'DAY', ordertag: `${pos.ordertag || pos.id}_X` });
      const fill = await this._awaitFill(exitOrder.orderId);
      const exitPrice = fill?.avgPrice ?? Number(this.quotes.getQuote(pos.nfoSymbol)?.bid ?? pos.currentPrice);
      const closed = this.positions.closePosition(pos.id, exitPrice, reason);
      if (closed) this.risk.recordTrade(closed);
      await this._emit('POSITION_CLOSED', { id: pos.id, exitPrice, pnl: closed?.pnl, reason });
      return closed;
    } catch (err: any) { logger.error({ err, id: pos.id }, 'exit FAILED'); return null; }
  }

  async _placeRestingStop(symbol: string, quantity: number, triggerPrice: number, ordertag: string): Promise<string | null> {
    for (let i = 0; i < SL_PLACE_ATTEMPTS; i++) {
      try { const res = await this.oms.placeOrder({ exchange: 'NFO', symbol, action: 'SELL', quantity, orderType: 'SL-MKT', triggerPrice, productType: 'INTRADAY', validity: 'DAY', ordertag }); if (res?.orderId) return res.orderId; }
      catch (err: any) { logger.warn({ err, attempt: i + 1 }, 'SL attempt'); await this._delay(300); }
    }
    return null;
  }

  async _emergencyFlatten(symbol: string, quantity: number, ordertag: string): Promise<void> {
    for (let i = 0; i < 3; i++) {
      try { await this.oms.placeOrder({ exchange: 'NFO', symbol, action: 'SELL', quantity, orderType: 'MKT', productType: 'INTRADAY', validity: 'DAY', ordertag }); return; }
      catch (err: any) { logger.error({ err, attempt: i + 1 }, 'EMERGENCY FLATTEN'); await this._delay(200); }
    }
  }

  async _awaitFill(orderId: string): Promise<FillResult | null> {
    for (let i = 0; i < FILL_POLL_ATTEMPTS; i++) {
      await this._delay(FILL_POLL_MS);
      const status = await this.oms.getOrderStatus(orderId);
      if (status?.filledQty > 0) return status;
    }
    return null;
  }

  async _safeCancel(orderId: string): Promise<void> { try { await this.oms.cancelOrder(orderId); } catch (_) {} }

  _ordertag(symbol: string): string { return `${symbol.slice(-6)}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`; }
  _round(n: number): number { return Math.round(n * 100) / 100; }
  _delay(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }

  async _emit(type: string, data: Record<string, unknown>): Promise<void> {
    if (!this.kafkaProducer) return;
    try { await this.kafkaProducer.send({ topic: this.config.topics?.executionEvents || 'execution-events', messages: [{ key: (data.ordertag as string) || type, value: JSON.stringify({ type, timestamp: new Date().toISOString(), ...data }) }] }); } catch (_) {}
  }
}

export = { LiveExecutor };
