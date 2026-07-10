const { parentPort } = require('worker_threads');
const technicalIndicators = require('technicalindicators');

// Optimized for Zero-Copy where possible (future enhancement: SharedArrayBuffer)
// Currently uses structured cloning which is fast for JS objects

/**
 * calculateIndicators
 * @param {Array} candles - Array of candle objects { close, high, low, ... }
 */
function calculateIndicators(candles) {
  if (!candles || candles.length === 0) return {};

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // RSI
  const rsi = technicalIndicators.RSI.calculate({
    values: closes,
    period: 14
  });

  // MACD
  const macd = technicalIndicators.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });

  // Bollinger Bands
  const bb = technicalIndicators.BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2
  });

  // Stochastic
  const stoch = technicalIndicators.Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3
  });

  // Return only the latest values to save bandwidth
  return {
    rsi: rsi[rsi.length - 1],
    macd: macd[macd.length - 1],
    bb: bb[bb.length - 1],
    stoch: stoch[stoch.length - 1]
  };
}

/**
 * calculateIndicatorsFull
 * Returns FULL arrays for charting
 */
function calculateIndicatorsFull(candles) {
  if (!candles || candles.length === 0) return {};

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const rsi = technicalIndicators.RSI.calculate({ values: closes, period: 14 });
  const macd = technicalIndicators.MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const bb = technicalIndicators.BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
  const stoch = technicalIndicators.Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 });
  const ema20 = technicalIndicators.EMA.calculate({ values: closes, period: 20 });
  const ema50 = technicalIndicators.EMA.calculate({ values: closes, period: 50 });
  const ema200 = technicalIndicators.EMA.calculate({ values: closes, period: 200 });
  const atr = technicalIndicators.ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const adx = technicalIndicators.ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const obv = technicalIndicators.OBV.calculate({ close: closes, volume: volumes });

  return {
    rsi,
    macd: {
        macd: macd.map(m => m.MACD),
        signal: macd.map(m => m.signal),
        histogram: macd.map(m => m.histogram)
    },
    bb: {
        upper: bb.map(b => b.upper),
        middle: bb.map(b => b.middle),
        lower: bb.map(b => b.lower)
    },
    stoch: {
        k: stoch.map(s => s.k),
        d: stoch.map(s => s.d)
    },
    ema: { ema20, ema50, ema200 },
    atr,
    adx: {
        adx: adx.map(a => a.adx),
        pdi: adx.map(a => a.pdi),
        ndi: adx.map(a => a.mdi)
    },
    obv
  };
}

/**
 * detectPatterns
 * @param {Array} candles 
 */
function detectPatterns(candles) {
  // Simple example of pattern detection logic offloaded to worker
  // Using last 5 candles
  const recent = candles.slice(-5);
  // ... complex pattern recognition logic here ...
  return []; // Placeholder
}

/**
 * runBacktest
 * Iterates through history to simulate trading
 */
function runBacktest({ candles, strategy }) {
  let signals = [];
  let balance = 10000;
  // ... emulation loop ...
  
  // Simulation of CPU heavy loop
  for (let i = 50; i < candles.length; i++) {
    // Math...
  }

  return { balance, signalsCount: signals.length };
}

// Router
module.exports = async ({ task, data }) => {
  switch (task) {
    case 'CALCULATE_INDICATORS':
      return calculateIndicators(data);
    case 'CALCULATE_INDICATORS_FULL':
      return calculateIndicatorsFull(data);
    case 'DETECT_PATTERNS':
      return detectPatterns(data);
    case 'RUN_BACKTEST':
      return runBacktest(data);
    default:
      throw new Error(`Unknown task: ${task}`);
  }
};
