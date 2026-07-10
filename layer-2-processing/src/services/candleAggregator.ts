/**
 * CandleAggregator — builds single-timeframe OHLCV candles from a tick stream.
 *
 * NOT idempotent: it has no tick identity, so a redelivered tick is summed twice.
 * Deduplication is the Kafka consumer's job (it owns offsets and message keys).
 *
 * Emits ONE timeframe, set by `intervalMs` (default 60s). Multi-timeframe candles
 * are derived downstream as TimescaleDB continuous aggregates, not here.
 */
const logger = require('../utils/logger');

interface Tick { symbol: string; ltp: number; volume?: number; exchange?: string; timestamp: number; }

interface Candle { time: Date; symbol: string; exchange: string; open: number; high: number; low: number; close: number; volume: number; trades: number; }

interface AggregatorStats { ticks: number; candles: number; }

class CandleAggregator {
  intervalMs: number; onCandleComplete: ((candle: Candle) => void) | undefined;
  candles: Record<string, Record<number, Candle>>; flushInterval: ReturnType<typeof setInterval>;
  stats: AggregatorStats;

  constructor(options: { intervalMs?: number; onCandleComplete?: (c: Candle) => void } = {}) {
    this.intervalMs = options.intervalMs || 60000;
    this.onCandleComplete = options.onCandleComplete;
    this.candles = {};
    this.stats = { ticks: 0, candles: 0 };
    this.flushInterval = setInterval(() => this.checkBoundaries(), 1000);
  }

  processTick(tick: Tick): void {
    this.stats.ticks++;
    const candleKey = this.getCandleKey(tick.timestamp);
    if (!this.candles[tick.symbol]) this.candles[tick.symbol] = {};
    let candle = this.candles[tick.symbol][candleKey];
    if (!candle) {
      this.flushPrevious(tick.symbol, candleKey);
      candle = { time: new Date(candleKey), symbol: tick.symbol, exchange: tick.exchange || 'NSE', open: tick.ltp, high: tick.ltp, low: tick.ltp, close: tick.ltp, volume: tick.volume || 0, trades: 1 };
      this.candles[tick.symbol][candleKey] = candle;
    } else {
      candle.high = Math.max(candle.high, tick.ltp); candle.low = Math.min(candle.low, tick.ltp);
      candle.close = tick.ltp; candle.volume += tick.volume || 0; candle.trades++;
    }
  }

  getCandleKey(timestamp: number): number { return Math.floor(timestamp / this.intervalMs) * this.intervalMs; }

  flushPrevious(symbol: string, newKey: number): void {
    const symbolCandles = this.candles[symbol];
    if (!symbolCandles) return;
    for (const key of Object.keys(symbolCandles).map(Number)) {
      if (key < newKey) { const c = symbolCandles[key]; delete symbolCandles[key]; this.stats.candles++; this.onCandleComplete?.(c); }
    }
  }

  /**
   * Flush candles whose interval has elapsed in wall-clock time.
   *
   * Without this, a candle only closes when the NEXT tick for that symbol arrives.
   * An illiquid symbol, or the final candle of the session, would never be emitted.
   * This body was empty (a comment describing work no code did) and no test covered it.
   */
  checkBoundaries(): void {
    const currentKey = this.getCandleKey(Date.now());
    for (const symbol of Object.keys(this.candles)) {
      this.flushPrevious(symbol, currentKey);
    }
  }

  flushAll(): void {
    for (const symbol of Object.keys(this.candles)) {
      for (const key of Object.keys(this.candles[symbol]).map(Number)) {
        const c = this.candles[symbol][key]; delete this.candles[symbol][key];
        this.stats.candles++; this.onCandleComplete?.(c);
      }
    }
  }

  getStats(): AggregatorStats & { activeSymbols: number } {
    return { ...this.stats, activeSymbols: Object.keys(this.candles).length };
  }

  destroy(): void { if (this.flushInterval) clearInterval(this.flushInterval); }
}

module.exports = { CandleAggregator };
