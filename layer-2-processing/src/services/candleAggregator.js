const logger = require('../utils/logger');

class CandleAggregator {
  constructor(options = {}) {
    this.intervalMs = options.intervalMs || 60000;
    this.onCandleComplete = options.onCandleComplete;
    this.candles = {};
    this.flushInterval = setInterval(() => this.checkBoundaries(), 1000);
    this.stats = { ticks: 0, candles: 0 };
    logger.info(`CandleAggregator: initialized with ${this.intervalMs}ms interval`);
  }

  processTick(tick) {
    this.stats.ticks++;
    const candleKey = this.getCandleKey(tick.timestamp);
    const symbol = tick.symbol;

    if (!this.candles[symbol]) {
      this.candles[symbol] = {};
    }

    let candle = this.candles[symbol][candleKey];

    if (!candle) {
      this.flushPrevious(symbol, candleKey);
      candle = {
        time: new Date(candleKey),
        symbol: symbol,
        exchange: tick.exchange || 'NSE',
        open: tick.ltp,
        high: tick.ltp,
        low: tick.ltp,
        close: tick.ltp,
        volume: tick.volume || 0,
        trades: 1,
      };
      this.candles[symbol][candleKey] = candle;
    } else {
      candle.high = Math.max(candle.high, tick.ltp);
      candle.low = Math.min(candle.low, tick.ltp);
      candle.close = tick.ltp;
      candle.volume += tick.volume || 0;
      candle.trades++;
    }
  }

  getCandleKey(timestamp) {
    const ts = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
    return Math.floor(ts / this.intervalMs) * this.intervalMs;
  }

  flushPrevious(symbol, currentCandleKey) {
    const symbolCandles = this.candles[symbol];
    if (!symbolCandles) return;

    for (const key in symbolCandles) {
      if (Number(key) !== currentCandleKey) {
        const candle = symbolCandles[key];
        delete symbolCandles[key];
        this.stats.candles++;
        if (this.onCandleComplete) {
          this.onCandleComplete(candle);
        }
      }
    }
  }

  checkBoundaries() {
    const now = Date.now();
    const currentKey = Math.floor(now / this.intervalMs) * this.intervalMs;

    for (const symbol in this.candles) {
      this.flushPrevious(symbol, currentKey);
    }
  }

  flushAll() {
    for (const symbol in this.candles) {
      const symbolCandles = this.candles[symbol];
      for (const key in symbolCandles) {
        const candle = symbolCandles[key];
        delete symbolCandles[key];
        this.stats.candles++;
        if (this.onCandleComplete) {
          this.onCandleComplete(candle);
        }
      }
    }
  }

  getStats() {
    return { ...this.stats, activeSymbols: Object.keys(this.candles).length };
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}

module.exports = { CandleAggregator };
