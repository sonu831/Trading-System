# Comprehensive Stock Analysis Dashboard - Implementation Plan

## Overview
Enhance the `/analysis/[symbol]` page with **multi-factor, multi-timeframe analysis** including 11+ technical indicators, candlestick pattern detection, volume analysis, options PCR, historical backtesting, and AI prediction — all displayed on a single unified page.

**Goal**: When a user opens `/analysis/RELIANCE`, they see:
- Price chart with overlay options (EMA, Bollinger Bands, Supertrend)
- RSI, MACD, Volume sub-charts
- Detected candlestick patterns
- Multi-timeframe verdict table (5m, 15m, 1h, 4h, 1d, 1w)
- AI prediction with confidence and reasoning
- Options PCR analysis (if data available)
- Historical backtest tool with statistics

---

## Bug Fix (Pre-requisite)

**File**: `layer-7-core-interface/api/src/modules/analysis/AnalysisRepository.js`

**Problem**: Line 29 maps `'1w': 'candles_1w'` but migration `003_additional_aggregates.sql` creates `candles_weekly`.

**Fix**:
```javascript
// Before (line 29)
'1w': 'candles_1w',

// After
'1w': 'candles_weekly',
```

---

## Phase 1: Backend — Enhanced Analysis Service

### 1A. AnalysisRepository — New Methods

**File**: `layer-7-core-interface/api/src/modules/analysis/AnalysisRepository.js`

#### Method: `getOptionsChain(symbol)`
```javascript
/**
 * Fetch latest options chain for PCR calculation
 * @param {string} symbol - Stock symbol (e.g., RELIANCE)
 * @returns {Promise<Array>} Array of {strike, option_type, oi, volume, iv}
 */
async getOptionsChain(symbol) {
  // Get nearest expiry with data
  const expiry = await this.prisma.$queryRaw`
    SELECT DISTINCT expiry
    FROM options_chain
    WHERE symbol = ${symbol}
      AND expiry >= CURRENT_DATE
    ORDER BY expiry ASC
    LIMIT 1
  `;

  if (!expiry.length) return [];

  // Get latest snapshot for that expiry
  return this.prisma.$queryRaw`
    SELECT strike, option_type, oi, volume, iv, ltp, delta, gamma, theta, vega
    FROM options_chain
    WHERE symbol = ${symbol}
      AND expiry = ${expiry[0].expiry}
      AND snapshot_time = (
        SELECT MAX(snapshot_time) FROM options_chain
        WHERE symbol = ${symbol} AND expiry = ${expiry[0].expiry}
      )
    ORDER BY strike ASC
  `;
}
```

#### Method: `hasOptionsData(symbol)`
```javascript
/**
 * Check if options data exists for conditional PCR panel
 * @param {string} symbol - Stock symbol
 * @returns {Promise<boolean>}
 */
async hasOptionsData(symbol) {
  const result = await this.prisma.$queryRaw`
    SELECT EXISTS(
      SELECT 1 FROM options_chain
      WHERE symbol = ${symbol}
        AND expiry >= CURRENT_DATE
      LIMIT 1
    ) as has_data
  `;
  return result[0]?.has_data || false;
}
```

#### Method: `getHistoricalCandles(symbol, days)`
```javascript
/**
 * Fetch extended historical data for backtesting
 * @param {string} symbol - Stock symbol
 * @param {number} days - Number of days (default 2500 = ~10 years)
 * @returns {Promise<Array>} Daily candles
 */
async getHistoricalCandles(symbol, days = 2500) {
  const rows = await this.prisma.$queryRaw`
    SELECT time, open, high, low, close, volume
    FROM candles_1d
    WHERE symbol = ${symbol}
    ORDER BY time DESC
    LIMIT ${days}
  `;
  return rows.reverse().map(row => ({
    time: row.time,
    open: parseFloat(row.open),
    high: parseFloat(row.high),
    low: parseFloat(row.low),
    close: parseFloat(row.close),
    volume: parseFloat(row.volume),
  }));
}
```

#### Enhance Existing: `getMultiTimeframeCandles(symbol)`
```javascript
// Change intervals from ['15m', '1h', '1d'] to:
const intervals = ['5m', '15m', '1h', '4h', '1d', '1w'];
```

---

### 1B. AnalysisService — New Indicator Methods

**File**: `layer-7-core-interface/api/src/modules/analysis/AnalysisService.js`

#### New Imports
```javascript
const {
  RSI, MACD, EMA, SMA,
  BollingerBands, ATR, ADX, Stochastic, OBV,
  bullish, bearish
} = require('technicalindicators');
```

---

#### Method: `calculateBollingerBands(closes, period = 20, stdDev = 2)`
```javascript
/**
 * Calculate Bollinger Bands
 * @param {Array<number>} closes - Close prices
 * @param {number} period - Moving average period (default 20)
 * @param {number} stdDev - Standard deviation multiplier (default 2)
 * @returns {Object} {upper: [], middle: [], lower: []}
 */
calculateBollingerBands(closes, period = 20, stdDev = 2) {
  const result = BollingerBands.calculate({
    values: closes,
    period,
    stdDev,
  });

  return {
    upper: result.map(r => r.upper),
    middle: result.map(r => r.middle),
    lower: result.map(r => r.lower),
  };
}
```

---

#### Method: `calculateATR(highs, lows, closes, period = 14)`
```javascript
/**
 * Calculate Average True Range for volatility measurement
 * @param {Array<number>} highs - High prices
 * @param {Array<number>} lows - Low prices
 * @param {Array<number>} closes - Close prices
 * @param {number} period - ATR period (default 14)
 * @returns {Array<number>} ATR values
 */
calculateATR(highs, lows, closes, period = 14) {
  return ATR.calculate({
    high: highs,
    low: lows,
    close: closes,
    period,
  });
}
```

---

#### Method: `calculateADX(highs, lows, closes, period = 14)`
```javascript
/**
 * Calculate Average Directional Index for trend strength
 * @param {Array<number>} highs - High prices
 * @param {Array<number>} lows - Low prices
 * @param {Array<number>} closes - Close prices
 * @param {number} period - ADX period (default 14)
 * @returns {Object} {adx: [], pdi: [], ndi: []}
 */
calculateADX(highs, lows, closes, period = 14) {
  const result = ADX.calculate({
    high: highs,
    low: lows,
    close: closes,
    period,
  });

  return {
    adx: result.map(r => r.adx),
    pdi: result.map(r => r.pdi),  // +DI
    ndi: result.map(r => r.mdi),  // -DI (library calls it mdi)
  };
}
```

---

#### Method: `calculateStochastic(highs, lows, closes)`
```javascript
/**
 * Calculate Stochastic Oscillator
 * @param {Array<number>} highs - High prices
 * @param {Array<number>} lows - Low prices
 * @param {Array<number>} closes - Close prices
 * @returns {Object} {k: [], d: []}
 */
calculateStochastic(highs, lows, closes) {
  const result = Stochastic.calculate({
    high: highs,
    low: lows,
    close: closes,
    period: 14,
    signalPeriod: 3,
  });

  return {
    k: result.map(r => r.k),
    d: result.map(r => r.d),
  };
}
```

---

#### Method: `calculateOBV(closes, volumes)`
```javascript
/**
 * Calculate On-Balance Volume
 * @param {Array<number>} closes - Close prices
 * @param {Array<number>} volumes - Volume data
 * @returns {Array<number>} OBV values
 */
calculateOBV(closes, volumes) {
  return OBV.calculate({
    close: closes,
    volume: volumes,
  });
}
```

---

#### Method: `calculateVWAP(highs, lows, closes, volumes)`
```javascript
/**
 * Calculate Volume Weighted Average Price (intraday indicator)
 * @param {Array<number>} highs - High prices
 * @param {Array<number>} lows - Low prices
 * @param {Array<number>} closes - Close prices
 * @param {Array<number>} volumes - Volume data
 * @returns {Array<number>} VWAP values
 */
calculateVWAP(highs, lows, closes, volumes) {
  const vwap = [];
  let cumulativeTPV = 0;  // Typical Price * Volume
  let cumulativeVolume = 0;

  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += typicalPrice * volumes[i];
    cumulativeVolume += volumes[i];
    vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
  }

  return vwap;
}
```

---

#### Method: `calculateSupertrend(highs, lows, closes, period = 10, multiplier = 3)`

**Algorithm** (mirrors Go Layer 4 logic):
```javascript
/**
 * Calculate Supertrend indicator
 * Supertrend = ATR-based trailing stop that flips direction on breakout
 *
 * @param {Array<number>} highs - High prices
 * @param {Array<number>} lows - Low prices
 * @param {Array<number>} closes - Close prices
 * @param {number} period - ATR period (default 10)
 * @param {number} multiplier - ATR multiplier (default 3)
 * @returns {Object} {value: [], direction: []} where direction: 1=bullish, -1=bearish
 */
calculateSupertrend(highs, lows, closes, period = 10, multiplier = 3) {
  const atrValues = this.calculateATR(highs, lows, closes, period);

  // Pad ATR to match input length (ATR has fewer values due to warmup)
  const paddedATR = Array(closes.length - atrValues.length).fill(null).concat(atrValues);

  const supertrend = [];
  const direction = [];

  let prevUpperBand = null;
  let prevLowerBand = null;
  let prevSupertrend = null;
  let prevDirection = 1; // Start bullish

  for (let i = 0; i < closes.length; i++) {
    if (paddedATR[i] === null) {
      supertrend.push(null);
      direction.push(null);
      continue;
    }

    // Calculate HL2 (typical median)
    const hl2 = (highs[i] + lows[i]) / 2;
    const atr = paddedATR[i];

    // Calculate basic bands
    let upperBand = hl2 + (multiplier * atr);
    let lowerBand = hl2 - (multiplier * atr);

    // Apply Supertrend trailing logic:
    // Lower band can only go UP (tighten stop in uptrend)
    if (prevLowerBand !== null && closes[i - 1] > prevLowerBand) {
      lowerBand = Math.max(lowerBand, prevLowerBand);
    }

    // Upper band can only go DOWN (tighten stop in downtrend)
    if (prevUpperBand !== null && closes[i - 1] < prevUpperBand) {
      upperBand = Math.min(upperBand, prevUpperBand);
    }

    // Determine direction and Supertrend value
    let currentDirection;
    let currentSupertrend;

    if (prevSupertrend === null) {
      // First valid bar - use close vs bands to determine initial direction
      currentDirection = closes[i] > upperBand ? 1 : -1;
      currentSupertrend = currentDirection === 1 ? lowerBand : upperBand;
    } else if (prevDirection === 1) {
      // Was bullish
      if (closes[i] < prevSupertrend) {
        // Close broke below lower band → flip to bearish
        currentDirection = -1;
        currentSupertrend = upperBand;
      } else {
        // Stay bullish
        currentDirection = 1;
        currentSupertrend = lowerBand;
      }
    } else {
      // Was bearish
      if (closes[i] > prevSupertrend) {
        // Close broke above upper band → flip to bullish
        currentDirection = 1;
        currentSupertrend = lowerBand;
      } else {
        // Stay bearish
        currentDirection = -1;
        currentSupertrend = upperBand;
      }
    }

    supertrend.push(currentSupertrend);
    direction.push(currentDirection);

    prevUpperBand = upperBand;
    prevLowerBand = lowerBand;
    prevSupertrend = currentSupertrend;
    prevDirection = currentDirection;
  }

  return { value: supertrend, direction };
}
```

---

#### Method: `calculateSupportResistance(highs, lows, closes, lookback = 50)`
```javascript
/**
 * Calculate dynamic support and resistance levels
 * Uses pivot points and recent swing highs/lows
 *
 * @param {Array<number>} highs - High prices
 * @param {Array<number>} lows - Low prices
 * @param {Array<number>} closes - Close prices
 * @param {number} lookback - Period for swing detection
 * @returns {Object} {support: [], resistance: [], pivotPoint: number}
 */
calculateSupportResistance(highs, lows, closes, lookback = 50) {
  const len = closes.length;
  if (len < lookback) return { support: [], resistance: [], pivotPoint: null };

  // Calculate classic pivot point from last bar
  const lastIdx = len - 1;
  const pivotPoint = (highs[lastIdx] + lows[lastIdx] + closes[lastIdx]) / 3;
  const range = highs[lastIdx] - lows[lastIdx];

  // Classic pivot levels
  const r1 = (2 * pivotPoint) - lows[lastIdx];
  const s1 = (2 * pivotPoint) - highs[lastIdx];
  const r2 = pivotPoint + range;
  const s2 = pivotPoint - range;
  const r3 = highs[lastIdx] + 2 * (pivotPoint - lows[lastIdx]);
  const s3 = lows[lastIdx] - 2 * (highs[lastIdx] - pivotPoint);

  // Find swing highs/lows in lookback period
  const recentHighs = highs.slice(-lookback);
  const recentLows = lows.slice(-lookback);

  // Swing high: bar with highest high in 5-bar window
  const swingHighs = [];
  const swingLows = [];

  for (let i = 2; i < lookback - 2; i++) {
    if (recentHighs[i] > recentHighs[i-1] && recentHighs[i] > recentHighs[i-2] &&
        recentHighs[i] > recentHighs[i+1] && recentHighs[i] > recentHighs[i+2]) {
      swingHighs.push(recentHighs[i]);
    }
    if (recentLows[i] < recentLows[i-1] && recentLows[i] < recentLows[i-2] &&
        recentLows[i] < recentLows[i+1] && recentLows[i] < recentLows[i+2]) {
      swingLows.push(recentLows[i]);
    }
  }

  return {
    support: [s1, s2, s3, ...swingLows].sort((a, b) => b - a).slice(0, 3),
    resistance: [r1, r2, r3, ...swingHighs].sort((a, b) => a - b).slice(0, 3),
    pivotPoint,
  };
}
```

---

#### Method: `detectCandlePatterns(candles)`
```javascript
/**
 * Detect candlestick patterns using technicalindicators library
 *
 * @param {Array<Object>} candles - OHLC candles
 * @returns {Array<Object>} [{index, time, patterns: [{name, type: 'bullish'|'bearish'}]}]
 */
detectCandlePatterns(candles) {
  const opens = candles.map(c => c.open);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  const patterns = [];

  // Bullish patterns to detect
  const bullishPatterns = [
    { fn: bullish.hammer, name: 'Hammer' },
    { fn: bullish.bullishengulfingpattern, name: 'Bullish Engulfing' },
    { fn: bullish.bullishharami, name: 'Bullish Harami' },
    { fn: bullish.morningstar, name: 'Morning Star' },
    { fn: bullish.threewhitesoldiers, name: 'Three White Soldiers' },
    { fn: bullish.dragonflydoji, name: 'Dragonfly Doji' },
    { fn: bullish.piercingline, name: 'Piercing Line' },
  ];

  // Bearish patterns to detect
  const bearishPatterns = [
    { fn: bearish.shootingstar, name: 'Shooting Star' },
    { fn: bearish.bearishengulfingpattern, name: 'Bearish Engulfing' },
    { fn: bearish.bearishharami, name: 'Bearish Harami' },
    { fn: bearish.eveningstar, name: 'Evening Star' },
    { fn: bearish.threeblackcrows, name: 'Three Black Crows' },
    { fn: bearish.gravestonedoji, name: 'Gravestone Doji' },
    { fn: bearish.hangingman, name: 'Hanging Man' },
  ];

  // Check each candle position (most patterns need 1-3 prior candles)
  for (let i = 3; i < candles.length; i++) {
    const detected = [];
    const input = {
      open: opens.slice(i - 3, i + 1),
      high: highs.slice(i - 3, i + 1),
      low: lows.slice(i - 3, i + 1),
      close: closes.slice(i - 3, i + 1),
    };

    // Check bullish patterns
    for (const { fn, name } of bullishPatterns) {
      try {
        if (fn(input)) {
          detected.push({ name, type: 'bullish' });
        }
      } catch (e) {
        // Pattern function may fail on insufficient data
      }
    }

    // Check bearish patterns
    for (const { fn, name } of bearishPatterns) {
      try {
        if (fn(input)) {
          detected.push({ name, type: 'bearish' });
        }
      } catch (e) {
        // Pattern function may fail on insufficient data
      }
    }

    if (detected.length > 0) {
      patterns.push({
        index: i,
        time: candles[i].time,
        patterns: detected,
      });
    }
  }

  return patterns;
}
```

---

#### Method: `calculatePCR(optionsData)`
```javascript
/**
 * Calculate Put-Call Ratio and related options metrics
 *
 * @param {Array<Object>} optionsData - Options chain from repository
 * @returns {Object} {pcrOI, pcrVolume, putOI, callOI, putVolume, callVolume, maxPainStrike}
 */
calculatePCR(optionsData) {
  if (!optionsData || optionsData.length === 0) return null;

  let putOI = 0, callOI = 0;
  let putVolume = 0, callVolume = 0;
  const strikeOI = {}; // For max pain calculation

  for (const opt of optionsData) {
    const strike = parseFloat(opt.strike);
    const oi = parseInt(opt.oi) || 0;
    const volume = parseInt(opt.volume) || 0;

    if (!strikeOI[strike]) {
      strikeOI[strike] = { callOI: 0, putOI: 0 };
    }

    if (opt.option_type === 'PE') {
      putOI += oi;
      putVolume += volume;
      strikeOI[strike].putOI += oi;
    } else if (opt.option_type === 'CE') {
      callOI += oi;
      callVolume += volume;
      strikeOI[strike].callOI += oi;
    }
  }

  // Max Pain: Strike where total loss to option writers is minimized
  // Calculated as strike where (call loss + put loss) is minimum
  let maxPainStrike = null;
  let minPain = Infinity;

  const strikes = Object.keys(strikeOI).map(Number).sort((a, b) => a - b);

  for (const expireStrike of strikes) {
    let totalPain = 0;

    for (const strike of strikes) {
      // Call writers lose if price > strike
      if (expireStrike > strike) {
        totalPain += strikeOI[strike].callOI * (expireStrike - strike);
      }
      // Put writers lose if price < strike
      if (expireStrike < strike) {
        totalPain += strikeOI[strike].putOI * (strike - expireStrike);
      }
    }

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = expireStrike;
    }
  }

  return {
    pcrOI: callOI > 0 ? (putOI / callOI).toFixed(2) : null,
    pcrVolume: callVolume > 0 ? (putVolume / callVolume).toFixed(2) : null,
    putOI,
    callOI,
    putVolume,
    callVolume,
    maxPainStrike,
    interpretation: this.interpretPCR(putOI / callOI),
  };
}

/**
 * Interpret PCR value
 */
interpretPCR(pcr) {
  if (pcr > 1.2) return { text: 'Extremely Bearish Sentiment (Contrarian Bullish)', color: 'success' };
  if (pcr > 1.0) return { text: 'Moderately Bearish Sentiment', color: 'warning' };
  if (pcr > 0.7) return { text: 'Neutral Sentiment', color: 'default' };
  if (pcr > 0.5) return { text: 'Moderately Bullish Sentiment', color: 'warning' };
  return { text: 'Extremely Bullish Sentiment (Contrarian Bearish)', color: 'error' };
}
```

---

#### Method: `computeVerdict(indicators)`

**7-Factor Scoring System** (max score: ±14):
```javascript
/**
 * Compute multi-factor verdict from all indicators
 *
 * @param {Object} indicators - All calculated indicators
 * @param {number} indicators.rsi - Latest RSI value
 * @param {number} indicators.macdHistogram - Latest MACD histogram
 * @param {Object} indicators.emas - {ema20, ema50, ema200}
 * @param {number} indicators.close - Latest close price
 * @param {number} indicators.supertrendDir - Supertrend direction (1/-1)
 * @param {Object} indicators.bb - {upper, middle, lower}
 * @param {number} indicators.adx - Latest ADX value
 * @param {Object} indicators.stochastic - {k, d}
 * @returns {Object} {signal, confidence, score, maxScore, factors}
 */
computeVerdict({ rsi, macdHistogram, emas, close, supertrendDir, bb, adx, stochastic }) {
  let score = 0;
  const factors = {};

  // Factor 1: RSI (±2)
  if (rsi !== null && rsi !== undefined) {
    if (rsi < 30) {
      score += 2;
      factors.rsi = { value: rsi, contribution: +2, reason: 'Oversold' };
    } else if (rsi < 40) {
      score += 1;
      factors.rsi = { value: rsi, contribution: +1, reason: 'Near Oversold' };
    } else if (rsi > 70) {
      score -= 2;
      factors.rsi = { value: rsi, contribution: -2, reason: 'Overbought' };
    } else if (rsi > 60) {
      score -= 1;
      factors.rsi = { value: rsi, contribution: -1, reason: 'Near Overbought' };
    } else {
      factors.rsi = { value: rsi, contribution: 0, reason: 'Neutral' };
    }
  }

  // Factor 2: MACD Histogram Momentum (±2)
  if (macdHistogram !== null && macdHistogram !== undefined) {
    if (macdHistogram > 0.5) {
      score += 2;
      factors.macd = { value: macdHistogram, contribution: +2, reason: 'Strong Bullish Momentum' };
    } else if (macdHistogram > 0) {
      score += 1;
      factors.macd = { value: macdHistogram, contribution: +1, reason: 'Bullish Momentum' };
    } else if (macdHistogram < -0.5) {
      score -= 2;
      factors.macd = { value: macdHistogram, contribution: -2, reason: 'Strong Bearish Momentum' };
    } else if (macdHistogram < 0) {
      score -= 1;
      factors.macd = { value: macdHistogram, contribution: -1, reason: 'Bearish Momentum' };
    } else {
      factors.macd = { value: macdHistogram, contribution: 0, reason: 'Neutral' };
    }
  }

  // Factor 3: EMA Alignment (±2)
  if (emas && close) {
    const above20 = close > emas.ema20;
    const above50 = close > emas.ema50;
    const above200 = close > emas.ema200;
    const emaAligned = emas.ema20 > emas.ema50 && emas.ema50 > emas.ema200;

    if (above20 && above50 && above200 && emaAligned) {
      score += 2;
      factors.ema = { contribution: +2, reason: 'Perfect Bullish Alignment' };
    } else if (above20 && above50) {
      score += 1;
      factors.ema = { contribution: +1, reason: 'Above Short-term EMAs' };
    } else if (!above20 && !above50 && !above200) {
      score -= 2;
      factors.ema = { contribution: -2, reason: 'Below All EMAs' };
    } else if (!above20 && !above50) {
      score -= 1;
      factors.ema = { contribution: -1, reason: 'Below Short-term EMAs' };
    } else {
      factors.ema = { contribution: 0, reason: 'Mixed EMA Position' };
    }
  }

  // Factor 4: Supertrend Direction (±2)
  if (supertrendDir !== null) {
    if (supertrendDir === 1) {
      score += 2;
      factors.supertrend = { value: 'Bullish', contribution: +2, reason: 'Uptrend Active' };
    } else {
      score -= 2;
      factors.supertrend = { value: 'Bearish', contribution: -2, reason: 'Downtrend Active' };
    }
  }

  // Factor 5: Bollinger Band Position (±2)
  if (bb && close) {
    const bbWidth = bb.upper - bb.lower;
    const position = (close - bb.lower) / bbWidth; // 0-1 range

    if (position < 0.2) {
      score += 2;
      factors.bb = { position: (position * 100).toFixed(0) + '%', contribution: +2, reason: 'Near Lower Band (Oversold)' };
    } else if (position < 0.35) {
      score += 1;
      factors.bb = { position: (position * 100).toFixed(0) + '%', contribution: +1, reason: 'Lower Half' };
    } else if (position > 0.8) {
      score -= 2;
      factors.bb = { position: (position * 100).toFixed(0) + '%', contribution: -2, reason: 'Near Upper Band (Overbought)' };
    } else if (position > 0.65) {
      score -= 1;
      factors.bb = { position: (position * 100).toFixed(0) + '%', contribution: -1, reason: 'Upper Half' };
    } else {
      factors.bb = { position: (position * 100).toFixed(0) + '%', contribution: 0, reason: 'Middle Band' };
    }
  }

  // Factor 6: ADX Trend Strength (±2)
  if (adx !== null && adx !== undefined) {
    // ADX > 25 = trending, < 20 = ranging
    // Combine with other factors to determine if trend strength is good
    if (adx > 25 && score > 0) {
      score += 2;
      factors.adx = { value: adx, contribution: +2, reason: 'Strong Uptrend' };
    } else if (adx > 25 && score < 0) {
      score -= 2;
      factors.adx = { value: adx, contribution: -2, reason: 'Strong Downtrend' };
    } else if (adx < 20) {
      factors.adx = { value: adx, contribution: 0, reason: 'Weak/Ranging Market' };
    } else {
      factors.adx = { value: adx, contribution: 0, reason: 'Moderate Trend' };
    }
  }

  // Factor 7: Stochastic Oscillator (±2)
  if (stochastic && stochastic.k !== null) {
    const { k, d } = stochastic;

    if (k < 20 && k > d) {
      score += 2;
      factors.stochastic = { k, d, contribution: +2, reason: 'Oversold + Bullish Crossover' };
    } else if (k < 30) {
      score += 1;
      factors.stochastic = { k, d, contribution: +1, reason: 'Oversold Zone' };
    } else if (k > 80 && k < d) {
      score -= 2;
      factors.stochastic = { k, d, contribution: -2, reason: 'Overbought + Bearish Crossover' };
    } else if (k > 70) {
      score -= 1;
      factors.stochastic = { k, d, contribution: -1, reason: 'Overbought Zone' };
    } else {
      factors.stochastic = { k, d, contribution: 0, reason: 'Neutral Zone' };
    }
  }

  // Determine signal and confidence
  const maxScore = 14; // 7 factors × ±2 each
  const confidence = Math.min(100, Math.abs(score / maxScore) * 100);

  let signal;
  if (score >= 6) signal = 'Strong Buy';
  else if (score >= 3) signal = 'Buy';
  else if (score <= -6) signal = 'Strong Sell';
  else if (score <= -3) signal = 'Sell';
  else signal = 'Neutral';

  return {
    signal,
    confidence: Math.round(confidence),
    score,
    maxScore,
    factors,
  };
}
```

---

### 1C. AnalysisService — Composite Methods

#### Method: `getCandlesWithFullIndicators(symbol, interval, limit = 500)`
```javascript
/**
 * Enhanced version of getCandlesWithIndicators
 * Returns all indicators including BB, ATR, Supertrend, volume analysis, candle patterns
 */
async getCandlesWithFullIndicators(symbol, interval, limit = 500) {
  const candles = await this.repository.getCandles(symbol, interval, limit);

  if (!candles || candles.length === 0) {
    return { candles: [], indicators: null, patterns: [], verdict: null };
  }

  const opens = candles.map(c => c.open);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  // Calculate all indicators
  const rsiValues = this.calculateRSI(closes);
  const macdData = this.calculateMACD(closes);
  const emaData = this.calculateEMAs(closes);
  const bbData = this.calculateBollingerBands(closes);
  const atrValues = this.calculateATR(highs, lows, closes);
  const adxData = this.calculateADX(highs, lows, closes);
  const stochData = this.calculateStochastic(highs, lows, closes);
  const obvValues = this.calculateOBV(closes, volumes);
  const supertrendData = this.calculateSupertrend(highs, lows, closes);
  const supportResistance = this.calculateSupportResistance(highs, lows, closes);

  // Volume analysis
  const volumeSMA = SMA.calculate({ values: volumes, period: 20 });

  // Detect candlestick patterns
  const patterns = this.detectCandlePatterns(candles);

  // Pad all arrays to match candle length
  const padArray = (arr, targetLength) => {
    const padding = Array(targetLength - arr.length).fill(null);
    return [...padding, ...arr];
  };

  const indicators = {
    rsi: padArray(rsiValues, candles.length),
    macd: {
      macd: padArray(macdData.macd, candles.length),
      signal: padArray(macdData.signal, candles.length),
      histogram: padArray(macdData.histogram, candles.length),
    },
    ema: {
      ema20: padArray(emaData.ema20, candles.length),
      ema50: padArray(emaData.ema50, candles.length),
      ema200: padArray(emaData.ema200, candles.length),
    },
    bb: {
      upper: padArray(bbData.upper, candles.length),
      middle: padArray(bbData.middle, candles.length),
      lower: padArray(bbData.lower, candles.length),
    },
    atr: padArray(atrValues, candles.length),
    adx: {
      adx: padArray(adxData.adx, candles.length),
      pdi: padArray(adxData.pdi, candles.length),
      ndi: padArray(adxData.ndi, candles.length),
    },
    stochastic: {
      k: padArray(stochData.k, candles.length),
      d: padArray(stochData.d, candles.length),
    },
    obv: padArray(obvValues, candles.length),
    supertrend: {
      value: supertrendData.value,
      direction: supertrendData.direction,
    },
    volume: {
      values: volumes,
      sma20: padArray(volumeSMA, candles.length),
    },
    supportResistance,
  };

  // Get latest values for verdict
  const latestIdx = candles.length - 1;
  const latestRSI = rsiValues[rsiValues.length - 1];
  const latestMACD = macdData.histogram[macdData.histogram.length - 1];
  const latestBB = {
    upper: bbData.upper[bbData.upper.length - 1],
    middle: bbData.middle[bbData.middle.length - 1],
    lower: bbData.lower[bbData.lower.length - 1],
  };
  const latestADX = adxData.adx[adxData.adx.length - 1];
  const latestStoch = {
    k: stochData.k[stochData.k.length - 1],
    d: stochData.d[stochData.d.length - 1],
  };

  // Compute verdict
  const verdict = this.computeVerdict({
    rsi: latestRSI,
    macdHistogram: latestMACD,
    emas: {
      ema20: emaData.ema20[emaData.ema20.length - 1],
      ema50: emaData.ema50[emaData.ema50.length - 1],
      ema200: emaData.ema200[emaData.ema200.length - 1],
    },
    close: closes[latestIdx],
    supertrendDir: supertrendData.direction[latestIdx],
    bb: latestBB,
    adx: latestADX,
    stochastic: latestStoch,
  });

  return {
    candles,
    indicators,
    patterns,
    summary: {
      latestRSI,
      trendState: this.getTrendFromRSI(latestRSI),
      signalBadge: this.getSignalBadge(latestRSI, macdData),
    },
    verdict,
  };
}
```

---

#### Method: `getEnhancedMultiTimeframeSummary(symbol)`
```javascript
/**
 * Get verdict for 6 timeframes with full indicator analysis
 */
async getEnhancedMultiTimeframeSummary(symbol) {
  const intervals = ['5m', '15m', '1h', '4h', '1d', '1w'];
  const summary = {};

  // Fetch all timeframes in parallel
  const results = await Promise.all(
    intervals.map(async (interval) => {
      try {
        const data = await this.getCandlesWithFullIndicators(symbol, interval, 100);
        return { interval, data };
      } catch (err) {
        console.error(`Failed to get ${interval} data for ${symbol}:`, err.message);
        return { interval, data: null, error: err.message };
      }
    })
  );

  for (const { interval, data, error } of results) {
    if (error || !data || !data.verdict) {
      summary[interval] = {
        verdict: { signal: 'No Data', confidence: 0 },
        rsi: null,
        trend: 'Unknown'
      };
    } else {
      const latestRSI = data.summary?.latestRSI;
      const latestMACD = data.indicators?.macd?.histogram?.slice(-1)[0];
      const supertrendDir = data.indicators?.supertrend?.direction?.slice(-1)[0];

      summary[interval] = {
        verdict: data.verdict,
        rsi: latestRSI,
        macdHistogram: latestMACD,
        supertrend: supertrendDir === 1 ? 'Bullish' : supertrendDir === -1 ? 'Bearish' : 'N/A',
        trend: data.summary?.trendState,
      };
    }
  }

  return summary;
}
```

---

#### Method: `getOptionsAnalysis(symbol)`
```javascript
/**
 * Get options analysis if data available
 */
async getOptionsAnalysis(symbol) {
  const hasData = await this.repository.hasOptionsData(symbol);
  if (!hasData) return null;

  const optionsChain = await this.repository.getOptionsChain(symbol);
  return this.calculatePCR(optionsChain);
}
```

---

#### Method: `getAIPrediction(symbol)`
```javascript
/**
 * Get AI prediction from Layer 9
 */
async getAIPrediction(symbol) {
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://ai-service:8000';

  try {
    // Get recent data to build feature vector
    const recentCandles = await this.repository.getCandles(symbol, '1d', 30);
    if (recentCandles.length < 14) {
      return { error: 'Insufficient data for prediction' };
    }

    const closes = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);

    // Build feature vector matching Layer 9 expectations
    const rsiValues = this.calculateRSI(closes);
    const macdData = this.calculateMACD(closes);
    const emaData = this.calculateEMAs(closes);

    const features = [{
      rsi: rsiValues[rsiValues.length - 1],
      macd: macdData.macd[macdData.macd.length - 1],
      ema50: emaData.ema50[emaData.ema50.length - 1],
      ema200: emaData.ema200[emaData.ema200.length - 1] || emaData.ema50[emaData.ema50.length - 1],
      close: closes[closes.length - 1],
      volume: volumes[volumes.length - 1],
    }];

    const response = await axios.post(`${AI_SERVICE_URL}/predict`, {
      symbol,
      features,
    });

    return {
      prediction: response.data.prediction,
      confidence: response.data.confidence,
      reasoning: response.data.reasoning || '',
      modelVersion: response.data.model_version,
    };
  } catch (err) {
    console.error(`AI prediction failed for ${symbol}:`, err.message);
    return { error: 'AI service unavailable' };
  }
}
```

---

#### Method: `runBacktest(symbol, indicator, operator, threshold)`
```javascript
/**
 * Run historical backtest for indicator conditions
 *
 * @param {string} symbol - Stock symbol
 * @param {string} indicator - 'rsi' | 'macd_hist' | 'stochastic_k' | 'bb_position'
 * @param {string} operator - 'lt' | 'gt' | 'lte' | 'gte'
 * @param {number} threshold - Threshold value
 * @returns {Object} Backtest results with statistics
 */
async runBacktest(symbol, indicator, operator, threshold) {
  // Fetch 10 years of daily data
  const candles = await this.repository.getHistoricalCandles(symbol, 2500);

  if (candles.length < 50) {
    return { error: 'Insufficient historical data' };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  // Calculate indicator based on type
  let indicatorValues;

  switch (indicator) {
    case 'rsi':
      indicatorValues = this.calculateRSI(closes);
      // Pad to match candle length
      indicatorValues = Array(candles.length - indicatorValues.length).fill(null).concat(indicatorValues);
      break;

    case 'macd_hist':
      const macdData = this.calculateMACD(closes);
      indicatorValues = Array(candles.length - macdData.histogram.length).fill(null).concat(macdData.histogram);
      break;

    case 'stochastic_k':
      const stochData = this.calculateStochastic(highs, lows, closes);
      indicatorValues = Array(candles.length - stochData.k.length).fill(null).concat(stochData.k);
      break;

    case 'bb_position':
      const bbData = this.calculateBollingerBands(closes);
      indicatorValues = [];
      const bbPadding = candles.length - bbData.upper.length;
      for (let i = 0; i < candles.length; i++) {
        if (i < bbPadding) {
          indicatorValues.push(null);
        } else {
          const idx = i - bbPadding;
          const width = bbData.upper[idx] - bbData.lower[idx];
          indicatorValues.push(width > 0 ? ((closes[i] - bbData.lower[idx]) / width) * 100 : 50);
        }
      }
      break;

    default:
      return { error: `Unknown indicator: ${indicator}` };
  }

  // Find signal dates based on condition
  const compare = (value, op, thresh) => {
    switch (op) {
      case 'lt': return value < thresh;
      case 'gt': return value > thresh;
      case 'lte': return value <= thresh;
      case 'gte': return value >= thresh;
      default: return false;
    }
  };

  const signals = [];

  // Look for signals (need at least 20 days forward for returns calculation)
  for (let i = 0; i < candles.length - 20; i++) {
    const value = indicatorValues[i];
    if (value === null) continue;

    // Check if condition met AND previous bar didn't meet it (entry signal)
    const prevValue = indicatorValues[i - 1];
    if (compare(value, operator, threshold) && (prevValue === null || !compare(prevValue, operator, threshold))) {
      const entryPrice = closes[i];
      const price5d = closes[i + 5];
      const price10d = closes[i + 10];
      const price20d = closes[i + 20];

      signals.push({
        date: candles[i].time,
        indicatorValue: value.toFixed(2),
        entryPrice: entryPrice.toFixed(2),
        return5d: ((price5d - entryPrice) / entryPrice * 100).toFixed(2),
        return10d: ((price10d - entryPrice) / entryPrice * 100).toFixed(2),
        return20d: ((price20d - entryPrice) / entryPrice * 100).toFixed(2),
      });
    }
  }

  if (signals.length === 0) {
    return {
      condition: { indicator, operator, threshold },
      signals: [],
      stats: null,
      message: 'No signals found for this condition'
    };
  }

  // Calculate statistics
  const returns5d = signals.map(s => parseFloat(s.return5d));
  const returns10d = signals.map(s => parseFloat(s.return10d));
  const returns20d = signals.map(s => parseFloat(s.return20d));

  const calcStats = (returns) => {
    const sorted = [...returns].sort((a, b) => a - b);
    const sum = returns.reduce((a, b) => a + b, 0);
    const avg = sum / returns.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const winners = returns.filter(r => r > 0).length;

    return {
      count: returns.length,
      avgReturn: avg.toFixed(2),
      medianReturn: median.toFixed(2),
      winRate: ((winners / returns.length) * 100).toFixed(1),
      best: Math.max(...returns).toFixed(2),
      worst: Math.min(...returns).toFixed(2),
    };
  };

  return {
    condition: { indicator, operator, threshold },
    signals: signals.slice(-50), // Return last 50 signals
    stats: {
      totalSignals: signals.length,
      period5d: calcStats(returns5d),
      period10d: calcStats(returns10d),
      period20d: calcStats(returns20d),
    },
  };
}
```

---

### 1D. New API Routes

**File**: `layer-7-core-interface/api/src/modules/analysis/routes.js`

```javascript
// Add to existing routes

/**
 * GET /api/market/analysis/:symbol
 * Combined endpoint for full analysis
 * Query: ?interval=15m&limit=500
 */
router.get('/analysis/:symbol', async (request, reply) => {
  return controller.getFullAnalysis(request, reply);
});

/**
 * GET /api/market/backtest/:symbol
 * Historical pattern backtest
 * Query: ?indicator=rsi&operator=lt&threshold=30
 */
router.get('/backtest/:symbol', async (request, reply) => {
  return controller.getBacktest(request, reply);
});

/**
 * GET /api/market/ai-predict/:symbol
 * AI prediction from Layer 9
 */
router.get('/ai-predict/:symbol', async (request, reply) => {
  return controller.getAIPrediction(request, reply);
});
```

---

### 1E. New Controller Handlers

**File**: `layer-7-core-interface/api/src/modules/analysis/AnalysisController.js`

```javascript
/**
 * Get full analysis for symbol
 */
getFullAnalysis = async (request, reply) => {
  try {
    const { symbol } = request.params;
    const { interval = '15m', limit = 500 } = request.query;

    // Fetch all data in parallel
    const [
      candlesWithIndicators,
      overview,
      enhancedMultiTF,
      optionsAnalysis,
    ] = await Promise.all([
      this.service.getCandlesWithFullIndicators(symbol, interval, parseInt(limit)),
      this.service.getStockOverview(symbol),
      this.service.getEnhancedMultiTimeframeSummary(symbol),
      this.service.getOptionsAnalysis(symbol),
    ]);

    return this.sendSuccess(reply, {
      symbol,
      interval,
      ...candlesWithIndicators,
      overview,
      multiTimeframe: enhancedMultiTF,
      options: optionsAnalysis,
    });
  } catch (err) {
    return this.sendError(reply, err);
  }
};

/**
 * Get backtest results
 */
getBacktest = async (request, reply) => {
  try {
    const { symbol } = request.params;
    const { indicator, operator, threshold } = request.query;

    if (!indicator || !operator || threshold === undefined) {
      return reply.status(400).send({
        error: 'Missing required query params: indicator, operator, threshold'
      });
    }

    const results = await this.service.runBacktest(
      symbol,
      indicator,
      operator,
      parseFloat(threshold)
    );

    return this.sendSuccess(reply, results);
  } catch (err) {
    return this.sendError(reply, err);
  }
};

/**
 * Get AI prediction
 */
getAIPrediction = async (request, reply) => {
  try {
    const { symbol } = request.params;
    const prediction = await this.service.getAIPrediction(symbol);
    return this.sendSuccess(reply, prediction);
  } catch (err) {
    return this.sendError(reply, err);
  }
};
```

---

### 1F. Layer 9 — Update PredictionResponse

**File**: `layer-9-ai-service/app/main.py`

```python
# Update PredictionResponse schema (lines 61-67)
class PredictionResponse(BaseModel):
    symbol: str
    prediction: float
    confidence: float
    model_version: str
    prompt_tokens: int
    completion_tokens: int
    reasoning: str = ""  # ADD THIS LINE

# Update /predict return dict (lines 109-116)
return {
    "symbol": request.symbol,
    "prediction": result.prediction,
    "confidence": result.confidence,
    "model_version": result.model_version,
    "prompt_tokens": result.prompt_tokens,
    "completion_tokens": result.completion_tokens,
    "reasoning": result.reasoning or "",  # ADD THIS LINE
}
```

---

## Phase 2: Frontend — Enhanced Symbol Page

### 2A. Enhanced Hook

**File**: `stock-analysis-portal/src/hooks/useAnalysis.js`

```javascript
import { useState, useEffect, useCallback } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api';

export default function useAnalysis(symbolParam) {
  // Existing state
  const [symbol, setSymbol] = useState(null);
  const [interval, setInterval] = useState('15m');
  const [candleData, setCandleData] = useState([]);
  const [indicators, setIndicators] = useState(null);
  const [summary, setSummary] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // NEW state
  const [patterns, setPatterns] = useState([]);
  const [verdict, setVerdict] = useState(null);
  const [enhancedMultiTF, setEnhancedMultiTF] = useState(null);
  const [optionsData, setOptionsData] = useState(null);
  const [aiPrediction, setAiPrediction] = useState(null);
  const [backtestResults, setBacktestResults] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Fetch full analysis (replaces separate calls)
  const fetchFullAnalysis = useCallback(async (sym, int) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/market/analysis/${sym}?interval=${int}&limit=500`
      );

      if (!response.ok) throw new Error('Failed to fetch analysis');

      const data = await response.json();

      setCandleData(data.candles || []);
      setIndicators(data.indicators);
      setSummary(data.summary);
      setPatterns(data.patterns || []);
      setVerdict(data.verdict);
      setOverview(data.overview);
      setEnhancedMultiTF(data.multiTimeframe);
      setOptionsData(data.options);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch AI prediction (on-demand)
  const fetchAIPrediction = useCallback(async (sym) => {
    setAiLoading(true);

    try {
      const response = await fetch(`${API_BASE}/market/ai-predict/${sym}`);
      if (!response.ok) throw new Error('AI prediction failed');

      const data = await response.json();
      setAiPrediction(data);
    } catch (err) {
      setAiPrediction({ error: err.message });
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Fetch backtest (on-demand)
  const fetchBacktest = useCallback(async (sym, indicator, operator, threshold) => {
    setBacktestLoading(true);

    try {
      const response = await fetch(
        `${API_BASE}/market/backtest/${sym}?indicator=${indicator}&operator=${operator}&threshold=${threshold}`
      );

      if (!response.ok) throw new Error('Backtest failed');

      const data = await response.json();
      setBacktestResults(data);
    } catch (err) {
      setBacktestResults({ error: err.message });
    } finally {
      setBacktestLoading(false);
    }
  }, []);

  // Initial fetch when symbol changes
  useEffect(() => {
    if (symbolParam) {
      setSymbol(symbolParam.toUpperCase());
      fetchFullAnalysis(symbolParam.toUpperCase(), interval);
    }
  }, [symbolParam, fetchFullAnalysis]);

  // Change interval
  const changeInterval = useCallback((newInterval) => {
    setInterval(newInterval);
    if (symbol) {
      fetchFullAnalysis(symbol, newInterval);
    }
  }, [symbol, fetchFullAnalysis]);

  // Refresh
  const refresh = useCallback(() => {
    if (symbol) {
      fetchFullAnalysis(symbol, interval);
    }
  }, [symbol, interval, fetchFullAnalysis]);

  return {
    symbol,
    interval,
    candleData,
    indicators,
    summary,
    overview,
    patterns,
    verdict,
    enhancedMultiTF,
    optionsData,
    aiPrediction,
    backtestResults,
    loading,
    error,
    aiLoading,
    backtestLoading,
    changeInterval,
    refresh,
    fetchAIPrediction,
    fetchBacktest,
  };
}
```

---

### 2B. Enhanced Existing Components

#### StockChart.jsx — Add Overlay Props
```jsx
// Add props: showBollinger, showSupertrend, showEMA
// Render BB as area fill between upper/lower bands
// Render Supertrend as line with color based on direction
```

#### IndicatorPanel.jsx — Add Volume Sub-chart
```jsx
// Add third sub-chart for volume
// Green bars for up candles, red for down
// 20-period SMA line overlay
```

---

### 2C. New Components

| Component | File | Description |
|-----------|------|-------------|
| `EnhancedMultiTFSummary.jsx` | Table showing 6 timeframes with RSI, MACD, Trend, Supertrend, BB Position, Verdict columns. Each verdict shows colored badge + confidence bar |
| `CandlePatternBadges.jsx` | Displays last 5 detected patterns as colored badges. Green for bullish, red for bearish |
| `PCRPanel.jsx` | Options analysis card: PCR OI, PCR Volume, Put/Call breakdown, Max Pain strike. Hidden gracefully if `data === null` |
| `AIPredictionPanel.jsx` | AI prediction card: circular gauge (% bullish/bearish), confidence bar, reasoning text, model version. Skeleton while loading |
| `BacktestPanel.jsx` | Condition builder (dropdown for indicator, operator, threshold input, presets), statistics grid, results table with color-coded returns |
| `IndicatorOverlayToggle.jsx` | Toggle button row: [EMA] [Bollinger] [Supertrend] |
| `SupportResistancePanel.jsx` | Displays pivot point, 3 support levels, 3 resistance levels with current price position indicator |

---

### 2D. Updated Page Layout

**File**: `stock-analysis-portal/src/pages/analysis/[symbol].js`

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER (existing)                                          │
├─────────────────────────────────────────────────────────────┤
│  STOCK HEADER CARD                                          │
│  [SYMBOL] ₹Price (+X.XX%) | [Strong Buy Badge] | RSI: XX    │
├─────────────────────────────────────────────────────────────┤
│  TIMEFRAME SELECTOR    |    OVERLAY TOGGLES                 │
│  [5m][15m][1h][4h][1d] |    [EMA][Bollinger][Supertrend]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  MAIN CANDLESTICK CHART (450px)                            │
│  + Bollinger Bands overlay (if enabled)                     │
│  + Supertrend line overlay (if enabled)                     │
│  + EMA lines overlay (if enabled)                           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  CANDLE PATTERN BADGES                                      │
│  [Bullish Engulfing] [Hammer] [Morning Star]               │
├─────────────────────────────────────────────────────────────┤
│  RSI CHART (100px)     │  MACD CHART (100px)               │
├─────────────────────────────────────────────────────────────┤
│  VOLUME CHART (100px)  │  Support/Resistance Panel          │
├─────────────────────────────────────────────────────────────┤
│  MULTI-TIMEFRAME SUMMARY TABLE                              │
│  ┌─────┬─────┬──────┬───────────┬────────┬─────────┐       │
│  │ TF  │ RSI │ MACD │ Supertrend│BB Pos  │ VERDICT │       │
│  ├─────┼─────┼──────┼───────────┼────────┼─────────┤       │
│  │ 5m  │ 45  │ +0.2 │ Bullish   │ 55%    │[Buy 72%]│       │
│  │ 15m │ 52  │ -0.1 │ Bullish   │ 48%    │[Neu 45%]│       │
│  │ 1h  │ 38  │ -0.5 │ Bearish   │ 22%    │[Sel 65%]│       │
│  │ ...                                              │       │
│  └─────┴─────┴──────┴───────────┴────────┴─────────┘       │
├─────────────────────────────────────────────────────────────┤
│  AI PREDICTION PANEL     │  OPTIONS PCR PANEL               │
│  ┌────────────────────┐  │  ┌────────────────────┐         │
│  │ [Gauge: 72% Bull]  │  │  │ PCR (OI): 1.25     │         │
│  │ Confidence: 85%    │  │  │ PCR (Vol): 0.95    │         │
│  │ Model: ollama-xxx  │  │  │ Put OI: 1.2M       │         │
│  │ Reasoning: ...     │  │  │ Call OI: 0.96M     │         │
│  │ [Fetch Prediction] │  │  │ Max Pain: ₹2450    │         │
│  └────────────────────┘  │  └────────────────────┘         │
│                          │  (Hidden if no options data)     │
├─────────────────────────────────────────────────────────────┤
│  BACKTEST PANEL (Full Width)                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Condition Builder:                                      ││
│  │ [RSI ▼] [< ▼] [30] [Run Backtest]                      ││
│  │ Presets: [RSI<30] [RSI>70] [MACD Cross] [Stoch<20]     ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Statistics:                                             ││
│  │ Signals: 45 | Avg 5D: +2.1% | Avg 10D: +3.5% | Win: 68%││
│  ├─────────────────────────────────────────────────────────┤│
│  │ Recent Signals Table:                                   ││
│  │ Date       │ RSI  │ Price │ 5D    │ 10D   │ 20D        ││
│  │ 2024-01-15 │ 28.5 │ ₹2350 │ +2.1% │ +3.8% │ +5.2%     ││
│  │ 2024-01-02 │ 29.1 │ ₹2280 │ +1.5% │ +2.9% │ +4.1%     ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  FOOTER                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

| Step | Task | File(s) |
|------|------|---------|
| 1 | Fix `candles_1w` → `candles_weekly` bug | `AnalysisRepository.js:29` |
| 2 | Add new indicator imports | `AnalysisService.js` |
| 3 | Add calculation methods: BB, ATR, ADX, Stochastic, OBV, VWAP, Supertrend, S/R, candlePatterns, PCR, computeVerdict | `AnalysisService.js` |
| 4 | Add repository methods: getOptionsChain, hasOptionsData, getHistoricalCandles | `AnalysisRepository.js` |
| 5 | Enhance getMultiTimeframeCandles intervals | `AnalysisRepository.js` |
| 6 | Add composite methods: getCandlesWithFullIndicators, getEnhancedMultiTF, runBacktest, getAIPrediction, getOptionsAnalysis | `AnalysisService.js` |
| 7 | Add controller handlers: getFullAnalysis, getBacktest, getAIPrediction | `AnalysisController.js` |
| 8 | Add routes: /analysis/:symbol, /backtest/:symbol, /ai-predict/:symbol | `routes.js` |
| 9 | Update Layer 9 PredictionResponse with reasoning field | `main.py` |
| 10 | Update useAnalysis hook with new state and fetch functions | `useAnalysis.js` |
| 11 | Enhance StockChart with BB + Supertrend overlays | `StockChart.jsx` |
| 12 | Enhance IndicatorPanel with Volume sub-chart | `IndicatorPanel.jsx` |
| 13 | Create EnhancedMultiTFSummary component | `EnhancedMultiTFSummary.jsx` |
| 14 | Create CandlePatternBadges component | `CandlePatternBadges.jsx` |
| 15 | Create PCRPanel component | `PCRPanel.jsx` |
| 16 | Create AIPredictionPanel component | `AIPredictionPanel.jsx` |
| 17 | Create BacktestPanel component | `BacktestPanel.jsx` |
| 18 | Create IndicatorOverlayToggle component | `IndicatorOverlayToggle.jsx` |
| 19 | Create SupportResistancePanel component | `SupportResistancePanel.jsx` |
| 20 | Restructure [symbol].js page with all new sections | `[symbol].js` |
| 21 | Update barrel exports | `Analysis/index.js` |

---

## API Response Examples

### GET /api/market/analysis/RELIANCE?interval=15m

```json
{
  "success": true,
  "data": {
    "symbol": "RELIANCE",
    "interval": "15m",
    "candles": [
      { "time": "2024-01-15T09:15:00Z", "open": 2450, "high": 2455, "low": 2448, "close": 2453, "volume": 125000 }
    ],
    "indicators": {
      "rsi": [null, null, "...", 52.3, 54.1],
      "macd": {
        "macd": ["..."],
        "signal": ["..."],
        "histogram": ["..."]
      },
      "ema": {
        "ema20": ["..."],
        "ema50": ["..."],
        "ema200": ["..."]
      },
      "bb": {
        "upper": ["..."],
        "middle": ["..."],
        "lower": ["..."]
      },
      "atr": ["..."],
      "adx": {
        "adx": ["..."],
        "pdi": ["..."],
        "ndi": ["..."]
      },
      "stochastic": {
        "k": ["..."],
        "d": ["..."]
      },
      "obv": ["..."],
      "supertrend": {
        "value": ["..."],
        "direction": [1, 1, 1, -1, -1, "..."]
      },
      "volume": {
        "values": ["..."],
        "sma20": ["..."]
      },
      "supportResistance": {
        "support": [2420, 2395, 2370],
        "resistance": [2475, 2490, 2520],
        "pivotPoint": 2452
      }
    },
    "patterns": [
      { "index": 245, "time": "2024-01-15T14:30:00Z", "patterns": [{ "name": "Bullish Engulfing", "type": "bullish" }] }
    ],
    "summary": {
      "latestRSI": 54.1,
      "trendState": "Neutral",
      "signalBadge": { "signal": "Neutral", "color": "warning" }
    },
    "verdict": {
      "signal": "Buy",
      "confidence": 58,
      "score": 4,
      "maxScore": 14,
      "factors": {
        "rsi": { "value": 54.1, "contribution": 0, "reason": "Neutral" },
        "macd": { "value": 0.35, "contribution": 1, "reason": "Bullish Momentum" },
        "ema": { "contribution": 1, "reason": "Above Short-term EMAs" },
        "supertrend": { "value": "Bullish", "contribution": 2, "reason": "Uptrend Active" },
        "bb": { "position": "42%", "contribution": 0, "reason": "Middle Band" },
        "adx": { "value": 28, "contribution": 0, "reason": "Moderate Trend" },
        "stochastic": { "k": 55, "d": 52, "contribution": 0, "reason": "Neutral Zone" }
      }
    },
    "overview": {
      "symbol": "RELIANCE",
      "price": 2453,
      "change": 18,
      "changePct": 0.74,
      "lastUpdated": "2024-01-15T15:30:00Z",
      "rsi": 54.1,
      "signal": { "signal": "Neutral", "color": "warning" }
    },
    "multiTimeframe": {
      "5m": { "verdict": { "signal": "Buy", "confidence": 65 }, "rsi": 48, "supertrend": "Bullish" },
      "15m": { "verdict": { "signal": "Neutral", "confidence": 42 }, "rsi": 54, "supertrend": "Bullish" },
      "1h": { "verdict": { "signal": "Sell", "confidence": 55 }, "rsi": 62, "supertrend": "Bearish" },
      "4h": { "verdict": { "signal": "Neutral", "confidence": 35 }, "rsi": 50, "supertrend": "Bullish" },
      "1d": { "verdict": { "signal": "Buy", "confidence": 70 }, "rsi": 45, "supertrend": "Bullish" },
      "1w": { "verdict": { "signal": "Strong Buy", "confidence": 82 }, "rsi": 38, "supertrend": "Bullish" }
    },
    "options": {
      "pcrOI": "1.25",
      "pcrVolume": "0.95",
      "putOI": 1250000,
      "callOI": 1000000,
      "putVolume": 95000,
      "callVolume": 100000,
      "maxPainStrike": 2450,
      "interpretation": { "text": "Extremely Bearish Sentiment (Contrarian Bullish)", "color": "success" }
    }
  }
}
```

### GET /api/market/backtest/RELIANCE?indicator=rsi&operator=lt&threshold=30

```json
{
  "success": true,
  "data": {
    "condition": { "indicator": "rsi", "operator": "lt", "threshold": 30 },
    "signals": [
      { "date": "2024-01-02", "indicatorValue": "28.50", "entryPrice": "2280.00", "return5d": "1.52", "return10d": "2.91", "return20d": "4.12" },
      { "date": "2023-10-15", "indicatorValue": "27.80", "entryPrice": "2150.00", "return5d": "3.25", "return10d": "5.10", "return20d": "7.85" }
    ],
    "stats": {
      "totalSignals": 45,
      "period5d": { "count": 45, "avgReturn": "2.10", "medianReturn": "1.85", "winRate": "68.9", "best": "8.50", "worst": "-3.20" },
      "period10d": { "count": 45, "avgReturn": "3.45", "medianReturn": "3.10", "winRate": "73.3", "best": "12.80", "worst": "-4.50" },
      "period20d": { "count": 45, "avgReturn": "5.20", "medianReturn": "4.80", "winRate": "77.8", "best": "18.50", "worst": "-6.20" }
    }
  }
}
```

### GET /api/market/ai-predict/RELIANCE

```json
{
  "success": true,
  "data": {
    "prediction": 0.72,
    "confidence": 0.85,
    "reasoning": "RSI at 45 indicates neutral momentum with room for upside. MACD histogram positive and expanding. Price above EMA50 and EMA200 confirms uptrend. Volume above average supports bullish bias. Recommend accumulation on dips.",
    "modelVersion": "ollama-llama3.2"
  }
}
```

---

## Performance Considerations

1. **Parallel fetching**: All timeframes in `getEnhancedMultiTimeframeSummary` are fetched with `Promise.all()`
2. **Single combined endpoint**: `/api/market/analysis/:symbol` reduces frontend API calls from 3 to 1
3. **Indicator warmup**: Pad arrays with `null` to maintain index alignment with candles
4. **Backtest limit**: Return only last 50 signals to avoid large payloads
5. **Options data check**: `hasOptionsData()` runs before expensive `getOptionsChain()` query
6. **AI prediction on-demand**: Not auto-fetched; user clicks button to trigger

---

## Verification Checklist

### Backend
- [ ] `'1w': 'candles_weekly'` fix applied
- [ ] All 11 indicator methods implemented and tested individually
- [ ] `computeVerdict()` returns correct score and factors
- [ ] `detectCandlePatterns()` identifies at least 5 pattern types
- [ ] `calculatePCR()` returns correct max pain strike
- [ ] `runBacktest()` returns statistics for all 3 periods
- [ ] `/api/market/analysis/RELIANCE` returns all expected fields
- [ ] `/api/market/backtest/RELIANCE?indicator=rsi&operator=lt&threshold=30` returns results
- [ ] `/api/market/ai-predict/RELIANCE` returns prediction with reasoning (requires Layer 9)

### Frontend
- [ ] `useAnalysis` hook fetches all data correctly
- [ ] StockChart renders BB bands as shaded area
- [ ] StockChart renders Supertrend line with correct colors
- [ ] IndicatorPanel shows Volume chart with SMA overlay
- [ ] EnhancedMultiTFSummary displays 6 timeframes with verdicts
- [ ] CandlePatternBadges shows last 5 patterns with correct colors
- [ ] PCRPanel hidden when `options === null`
- [ ] AIPredictionPanel shows skeleton while loading
- [ ] BacktestPanel condition builder works with all 4 indicators
- [ ] BacktestPanel results table shows color-coded returns
- [ ] Overlay toggles correctly show/hide chart overlays

### Integration
- [ ] Full page loads in < 3 seconds
- [ ] Changing timeframe updates all components
- [ ] Refresh button reloads all data
- [ ] Symbol with no options data: PCR panel hidden gracefully
- [ ] Symbol with no data: appropriate error state shown
- [ ] AI prediction button triggers fetch and updates panel
- [ ] Backtest presets populate correct values

---

## File Summary

| File | Changes |
|------|---------|
| `layer-7-core-interface/api/src/modules/analysis/AnalysisRepository.js` | Fix candles_1w bug + add 3 methods |
| `layer-7-core-interface/api/src/modules/analysis/AnalysisService.js` | Add 11 indicator methods + 5 composite methods |
| `layer-7-core-interface/api/src/modules/analysis/AnalysisController.js` | Add 3 handlers |
| `layer-7-core-interface/api/src/modules/analysis/routes.js` | Add 3 routes |
| `layer-9-ai-service/app/main.py` | Add reasoning field to response |
| `stock-analysis-portal/src/hooks/useAnalysis.js` | New state + fetch functions |
| `stock-analysis-portal/src/components/features/Analysis/components/StockChart.jsx` | BB + Supertrend overlays |
| `stock-analysis-portal/src/components/features/Analysis/components/IndicatorPanel.jsx` | Volume sub-chart |
| `stock-analysis-portal/src/components/features/Analysis/components/EnhancedMultiTFSummary.jsx` | NEW |
| `stock-analysis-portal/src/components/features/Analysis/components/CandlePatternBadges.jsx` | NEW |
| `stock-analysis-portal/src/components/features/Analysis/components/PCRPanel.jsx` | NEW |
| `stock-analysis-portal/src/components/features/Analysis/components/AIPredictionPanel.jsx` | NEW |
| `stock-analysis-portal/src/components/features/Analysis/components/BacktestPanel.jsx` | NEW |
| `stock-analysis-portal/src/components/features/Analysis/components/IndicatorOverlayToggle.jsx` | NEW |
| `stock-analysis-portal/src/components/features/Analysis/components/SupportResistancePanel.jsx` | NEW |
| `stock-analysis-portal/src/pages/analysis/[symbol].js` | Restructure with all sections |
| `stock-analysis-portal/src/components/features/Analysis/index.js` | Update barrel exports |

**Total: 17 files modified/created**
