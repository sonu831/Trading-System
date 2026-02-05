const { RSI, MACD, EMA } = require('technicalindicators');
const axios = require('axios');

/**
 * @class AnalysisService
 * @description Service for technical analysis calculations.
 * Uses technicalindicators library for RSI, MACD, EMA.
 */
class AnalysisService {
  /**
   * @param {Object} dependencies
   * @param {AnalysisRepository} dependencies.analysisRepository
   */
  constructor({ analysisRepository }) {
    this.repository = analysisRepository;
    this.analysisUrl = process.env.ANALYSIS_SERVICE_URL || 'http://analysis:8081';
  }

  /**
   * Get Market Sentiment from AI Layer (Go Service)
   * @returns {Promise<Object>} Market sentiment data
   */
  async getMarketSentiment() {
    try {
      const response = await axios.get(`${this.analysisUrl}/analyze/market`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch market sentiment from AI Layer:', error.message);
      // Return fallback data instead of crashing
      return {
        sentiment: 'Neutral',
        score: 0,
        summary: 'AI Analysis unavailable',
        top_picks: []
      };
    }
  }

  /**
   * Calculate RSI indicator
   * @param {Array<number>} closes - Array of close prices
   * @param {number} period - RSI period (default 14)
   * @returns {Array<number>} RSI values
   */
  calculateRSI(closes, period = 14) {
    return RSI.calculate({
      values: closes,
      period,
    });
  }

  /**
   * Calculate MACD indicator
   * @param {Array<number>} closes - Array of close prices
   * @returns {Object} { MACD, signal, histogram }
   */
  calculateMACD(closes) {
    const macdResult = MACD.calculate({
      values: closes,
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      SimpleMAOscillator: false,
      SimpleMASignal: false,
    });

    return {
      macd: macdResult.map((r) => r.MACD),
      signal: macdResult.map((r) => r.signal),
      histogram: macdResult.map((r) => r.histogram),
    };
  }

  /**
   * Calculate EMA indicators
   * @param {Array<number>} closes - Array of close prices
   * @returns {Object} { ema20, ema50, ema200 }
   */
  calculateEMAs(closes) {
    return {
      ema20: EMA.calculate({ values: closes, period: 20 }),
      ema50: EMA.calculate({ values: closes, period: 50 }),
      ema200: EMA.calculate({ values: closes, period: 200 }),
    };
  }

  /**
   * Determine trend state from RSI
   * @param {number} rsi - Current RSI value
   * @returns {string} Trend state
   */
  getTrendFromRSI(rsi) {
    if (rsi === null || rsi === undefined) return 'Unknown';
    if (rsi > 70) return 'Overbought';
    if (rsi > 60) return 'Bullish';
    if (rsi < 30) return 'Oversold';
    if (rsi < 40) return 'Bearish';
    return 'Neutral';
  }

  /**
   * Get signal badge from indicators
   * @param {number} rsi - RSI value
   * @param {Object} macd - MACD data
   * @returns {Object} { signal, color }
   */
  getSignalBadge(rsi, macd) {
    const latestHistogram = macd?.histogram?.[macd.histogram.length - 1];
    const prevHistogram = macd?.histogram?.[macd.histogram.length - 2];

    let score = 0;

    // RSI scoring
    if (rsi > 70) score -= 2;
    else if (rsi > 60) score += 1;
    else if (rsi < 30) score += 2;
    else if (rsi < 40) score -= 1;

    // MACD histogram momentum
    if (latestHistogram && prevHistogram) {
      if (latestHistogram > prevHistogram && latestHistogram > 0) score += 1;
      if (latestHistogram < prevHistogram && latestHistogram < 0) score -= 1;
    }

    // Determine signal
    if (score >= 2) return { signal: 'Strong Buy', color: 'success' };
    if (score >= 1) return { signal: 'Buy', color: 'success' };
    if (score <= -2) return { signal: 'Strong Sell', color: 'error' };
    if (score <= -1) return { signal: 'Sell', color: 'error' };
    return { signal: 'Neutral', color: 'warning' };
  }

  /**
   * Fetch candles with calculated indicators
   * @param {string} symbol - Stock symbol
   * @param {string} interval - Timeframe
   * @param {number} limit - Number of candles
   * @returns {Promise<Object>} Candles and indicators
   */
  async getCandlesWithIndicators(symbol, interval, limit) {
    const candles = await this.repository.getCandles(symbol, interval, limit);

    if (!candles || candles.length === 0) {
      return { candles: [], indicators: null };
    }

    const closes = candles.map((c) => parseFloat(c.close));

    // Calculate indicators
    const rsiValues = this.calculateRSI(closes);
    const macdData = this.calculateMACD(closes);
    const emaData = this.calculateEMAs(closes);

    // Pad indicators to match candle length (indicators have fewer values due to warmup)
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
    };

    // Latest RSI for signal
    const latestRSI = rsiValues[rsiValues.length - 1];
    const signalBadge = this.getSignalBadge(latestRSI, macdData);

    return {
      candles,
      indicators,
      summary: {
        latestRSI,
        trendState: this.getTrendFromRSI(latestRSI),
        signalBadge,
      },
    };
  }

  /**
   * Get stock overview (price, change, signal)
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Stock overview
   */
  async getStockOverview(symbol) {
    const [latest, prevClose] = await Promise.all([
      this.repository.getLatestPrice(symbol),
      this.repository.getPreviousClose(symbol),
    ]);

    if (!latest) {
      return null;
    }

    const currentPrice = parseFloat(latest.close);
    const previousClose = prevClose ? parseFloat(prevClose) : currentPrice;
    const change = currentPrice - previousClose;
    const changePct = previousClose ? (change / previousClose) * 100 : 0;

    // Get short-term RSI for signal
    const recentCandles = await this.repository.getCandles(symbol, '15m', 50);
    const closes = recentCandles.map((c) => parseFloat(c.close));
    const rsiValues = this.calculateRSI(closes);
    const latestRSI = rsiValues[rsiValues.length - 1];
    const macdData = this.calculateMACD(closes);

    return {
      symbol,
      price: currentPrice,
      change,
      changePct,
      lastUpdated: latest.time,
      rsi: latestRSI,
      signal: this.getSignalBadge(latestRSI, macdData),
    };
  }

  /**
   * Get multi-timeframe analysis summary
   * @param {string} symbol - Stock symbol
   * @returns {Promise<Object>} Multi-TF analysis
   */
  async getMultiTimeframeSummary(symbol) {
    // Exclude 1w as that table may not exist
    const intervals = ['15m', '1h', '1d'];
    const summary = {};

    for (const interval of intervals) {
      try {
        const candles = await this.repository.getCandles(symbol, interval, 50);
        if (candles && candles.length > 0) {
          const closes = candles.map((c) => parseFloat(c.close));
          const rsiValues = this.calculateRSI(closes);
          const latestRSI = rsiValues[rsiValues.length - 1];

          summary[interval] = {
            rsi: latestRSI,
            trend: this.getTrendFromRSI(latestRSI),
          };
        } else {
          summary[interval] = { rsi: null, trend: 'No Data' };
        }
      } catch (err) {
        console.error(`Failed to get ${interval} data for ${symbol}:`, err.message);
        summary[interval] = { rsi: null, trend: 'Error' };
      }
    }

    return summary;
  }
}

module.exports = AnalysisService;
