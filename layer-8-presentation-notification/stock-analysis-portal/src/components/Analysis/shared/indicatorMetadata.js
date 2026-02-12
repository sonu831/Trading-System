/**
 * Static indicator metadata — descriptions, formulas, interpretation zones.
 * This data is baked into the frontend so InfoIcons always work
 * without needing a separate API call.
 */
const INDICATOR_METADATA = {
  rsi: {
    name: 'RSI (Relative Strength Index)',
    description:
      'Measures momentum by comparing the magnitude of recent gains to recent losses. Identifies overbought/oversold conditions and potential trend reversals.',
    formula: 'RSI = 100 − (100 / (1 + RS)), where RS = Avg Gain / Avg Loss over 14 periods',
    parameters: { period: 14 },
    zones: {
      'Overbought (> 70)': 'Price is extended — potential pullback or reversal likely',
      'Neutral (30–70)': 'Normal momentum — no extreme signal',
      'Oversold (< 30)': 'Price is depressed — potential bounce or reversal likely',
    },
    scoring: '+2 if < 30 (oversold → bullish), −2 if > 70 (overbought → bearish), else 0',
    maxScore: 2,
    getValue: (indicators) => indicators?.rsi?.[indicators.rsi.length - 1],
    getState: (val) => {
      if (val == null) return 'N/A';
      if (val > 70) return 'Overbought';
      if (val < 30) return 'Oversold';
      return 'Neutral';
    },
    formatValue: (val) => val?.toFixed(1) ?? 'N/A',
  },

  macd: {
    name: 'MACD (Moving Average Convergence Divergence)',
    description:
      'Tracks the relationship between two EMAs (12 & 26 period). The histogram shows momentum strength — positive = bullish, negative = bearish.',
    formula: 'MACD Line = EMA(12) − EMA(26); Signal = EMA(9) of MACD; Histogram = MACD − Signal',
    parameters: { fast: 12, slow: 26, signal: 9 },
    zones: {
      'Bullish Crossover': 'MACD crosses above signal line — buy signal',
      'Bearish Crossover': 'MACD crosses below signal line — sell signal',
      'Histogram > 0': 'Bullish momentum strengthening',
      'Histogram < 0': 'Bearish momentum strengthening',
    },
    scoring: '+2 if histogram > 0 AND MACD > signal (strong bullish), −2 if histogram < 0 AND MACD < signal (strong bearish)',
    maxScore: 2,
    getValue: (indicators) => {
      const macd = indicators?.macd;
      if (!macd) return null;
      const len = macd.macd?.length;
      if (!len) return null;
      return {
        macd: macd.macd[len - 1],
        signal: macd.signal?.[len - 1],
        histogram: macd.histogram?.[len - 1],
      };
    },
    getState: (val) => {
      if (!val) return 'N/A';
      if (val.histogram > 0) return 'Bullish';
      if (val.histogram < 0) return 'Bearish';
      return 'Neutral';
    },
    formatValue: (val) =>
      val ? `H: ${val.histogram?.toFixed(2)}` : 'N/A',
  },

  ema: {
    name: 'EMA (Exponential Moving Averages)',
    description:
      'Three EMAs (20, 50, 200) show short/medium/long-term trend. When shorter EMAs are above longer ones, it signals a bullish trend (Golden Cross). When reversed, it signals bearish (Death Cross).',
    formula: 'EMA = Price × k + EMA(prev) × (1 − k), where k = 2 / (period + 1)',
    parameters: { periods: [20, 50, 200] },
    zones: {
      'Perfect Bullish (EMA20 > 50 > 200)': 'Strong uptrend — all moving averages aligned',
      'Bearish Alignment (EMA20 < 50 < 200)': 'Strong downtrend — all moving averages reversed',
      'Mixed': 'Transitioning trend — some MAs crossed, some not',
    },
    scoring: '+2 for perfect bullish alignment, −2 for perfect bearish, +1/−1 for partial alignment',
    maxScore: 2,
    getValue: (indicators) => {
      const ema = indicators?.ema;
      if (!ema) return null;
      return {
        ema20: ema.ema20?.[ema.ema20.length - 1],
        ema50: ema.ema50?.[ema.ema50.length - 1],
        ema200: ema.ema200?.[ema.ema200.length - 1],
      };
    },
    getState: (val) => {
      if (!val || val.ema20 == null) return 'N/A';
      if (val.ema20 > val.ema50 && val.ema50 > val.ema200) return 'Bullish Alignment';
      if (val.ema20 < val.ema50 && val.ema50 < val.ema200) return 'Bearish Alignment';
      return 'Mixed';
    },
    formatValue: (val) =>
      val
        ? `20: ${val.ema20?.toFixed(1)} | 50: ${val.ema50?.toFixed(1)} | 200: ${val.ema200?.toFixed(1)}`
        : 'N/A',
  },

  supertrend: {
    name: 'Supertrend',
    description:
      'Trend-following indicator based on ATR (Average True Range). Plots above/below price to show current trend direction. A flip from below to above signals a sell, and above to below signals a buy.',
    formula: 'Upper Band = (High + Low)/2 + Multiplier × ATR; Lower Band = (High + Low)/2 − Multiplier × ATR',
    parameters: { period: 10, multiplier: 3 },
    zones: {
      'Bullish (▲)': 'Price above Supertrend — uptrend confirmed',
      'Bearish (▼)': 'Price below Supertrend — downtrend confirmed',
    },
    scoring: '+2 if bullish, −2 if bearish',
    maxScore: 2,
    getValue: (indicators) => {
      const st = indicators?.supertrend;
      if (!st?.direction) return null;
      return st.direction[st.direction.length - 1];
    },
    getState: (val) => {
      if (val === 1) return 'Bullish';
      if (val === -1) return 'Bearish';
      return 'N/A';
    },
    formatValue: (val) => (val === 1 ? '▲ Bullish' : val === -1 ? '▼ Bearish' : 'N/A'),
  },

  bb: {
    name: 'Bollinger Bands',
    description:
      'Measures volatility with a 20-period SMA ± 2 standard deviations. Price near the upper band suggests overbought, near the lower band suggests oversold. Band width indicates volatility.',
    formula: 'Middle = SMA(20); Upper = Middle + 2×StdDev; Lower = Middle − 2×StdDev',
    parameters: { period: 20, stdDev: 2 },
    zones: {
      'Near Upper Band (> 80%)': 'Potential overbought — watch for reversal',
      'Mid-Range (20–80%)': 'Normal trading range',
      'Near Lower Band (< 20%)': 'Potential oversold — watch for bounce',
      'Squeeze': 'Bands narrowing — volatility expansion expected',
    },
    scoring: '+2 if near lower band (oversold), −2 if near upper band (overbought)',
    maxScore: 2,
    getValue: (indicators) => {
      const bb = indicators?.bollingerBands;
      if (!bb?.upper?.length) return null;
      const len = bb.upper.length;
      return {
        upper: bb.upper[len - 1],
        middle: bb.middle?.[len - 1],
        lower: bb.lower?.[len - 1],
      };
    },
    getState: (val) => {
      if (!val) return 'N/A';
      return 'Active';
    },
    formatValue: (val) =>
      val
        ? `U: ${val.upper?.toFixed(1)} | M: ${val.middle?.toFixed(1)} | L: ${val.lower?.toFixed(1)}`
        : 'N/A',
  },

  adx: {
    name: 'ADX (Average Directional Index)',
    description:
      'Measures trend strength regardless of direction. High ADX means a strong trend (either up or down). Low ADX means a weak or ranging market.',
    formula: 'ADX = SMA of DX over 14 periods; DX = |+DI − −DI| / (+DI + −DI) × 100',
    parameters: { period: 14 },
    zones: {
      'Strong Trend (> 25)': 'Clear directional move — trend strategies work well',
      'Weak/Ranging (< 20)': 'No clear trend — range-bound strategies preferred',
      'Moderate (20–25)': 'Trend emerging or fading',
    },
    scoring: '+2 if ADX > 25 AND +DI > −DI (strong bullish trend), −2 if ADX > 25 AND −DI > +DI (strong bearish)',
    maxScore: 2,
    getValue: (indicators) => {
      const adx = indicators?.adx;
      if (!adx?.adx?.length) return null;
      return adx.adx[adx.adx.length - 1];
    },
    getState: (val) => {
      if (val == null) return 'N/A';
      if (val > 25) return 'Strong Trend';
      if (val < 20) return 'Weak/Ranging';
      return 'Moderate';
    },
    formatValue: (val) => val?.toFixed(1) ?? 'N/A',
  },

  stochastic: {
    name: 'Stochastic Oscillator',
    description:
      'Compares closing price to its price range over 14 periods. Like RSI, identifies overbought/oversold but reacts faster to price changes.',
    formula: '%K = (Close − Low₁₄) / (High₁₄ − Low₁₄) × 100; %D = SMA(3) of %K',
    parameters: { kPeriod: 14, dPeriod: 3 },
    zones: {
      'Overbought (> 80)': 'Price near top of range — potential pullback',
      'Neutral (20–80)': 'Normal range — no extreme signal',
      'Oversold (< 20)': 'Price near bottom of range — potential bounce',
    },
    scoring: '+2 if < 20 (oversold → bullish), −2 if > 80 (overbought → bearish)',
    maxScore: 2,
    getValue: (indicators) => {
      const stoch = indicators?.stochastic;
      if (!stoch?.k?.length) return null;
      return {
        k: stoch.k[stoch.k.length - 1],
        d: stoch.d?.[stoch.d.length - 1],
      };
    },
    getState: (val) => {
      if (!val) return 'N/A';
      if (val.k > 80) return 'Overbought';
      if (val.k < 20) return 'Oversold';
      return 'Neutral';
    },
    formatValue: (val) =>
      val ? `%K: ${val.k?.toFixed(1)} | %D: ${val.d?.toFixed(1)}` : 'N/A',
  },
};

export default INDICATOR_METADATA;
