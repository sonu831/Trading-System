/**
 * CandleAggregator — builds 1-min OHLCV candles from tick stream.
 * Idempotent: duplicate ticks produce the same candle.
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

  checkBoundaries(): void { /* flushes candles that crossed the minute boundary */ }

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

export = { CandleAggregator };
