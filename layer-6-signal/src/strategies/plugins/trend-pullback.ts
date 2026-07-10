const { BaseStrategy } = require('../base');
const { EMA, ATR } = require('../../regime/indicators');

class TrendPullbackStrategy extends BaseStrategy {
  constructor() {
    super({
      id: 'trend-pullback',
      version: '1.0',
      tier: 'T2',
      description: 'Catches pullbacks in trending markets on 15m structure (T2/T3)',
      regimeAffinity: ['TREND_UP', 'TREND_DOWN'],
      params: {
        triggerTF: '15m',
        contextTF: '1h',
        pullbackEmaPeriod: 21,
        pullbackMaxPct: 0.5,
        rsiOversold: 40,
        rsiOverbought: 60,
        stopLossPct: 25,
        targetR: 2.5,
        trailingTriggerPct: 15,
        highVolOk: false,
        minTfAlignment: 0.3,
      },
    });
  }

  evaluateEntry(ctx) {
    const { candles, regime, breadth } = ctx;
    const tf = this.params.triggerTF;
    const triggerCandles = candles[tf];

    if (!triggerCandles || triggerCandles.length < 30) return null;

    const closes = triggerCandles.map(c => c.close);
    const lastCandle = triggerCandles[triggerCandles.length - 1];
    const lastClose = lastCandle.close;

    // Must be in a trending regime with some TF alignment
    if (!regime || regime.strength < 0.3) return null;
    if (regime.alignmentConfidence < this.params.minTfAlignment) return null;

    const direction = this.getDirection(regime);
    if (!direction) return null;

    const ema21 = EMA(closes, this.params.pullbackEmaPeriod);
    if (!ema21) return null;

    // Check if this is a pullback: price pulled back to EMA but trend intact
    if (direction === 'LONG') {
      const ema55 = EMA(closes, 55);
      if (!ema55 || lastClose < ema55) return null; // Major trend broken — not a pullback

      // Price near or at EMA21 (pullback zone)
      const pctFromEMA = Math.abs(lastClose - ema21) / ema21 * 100;
      if (pctFromEMA > 5) return null; // Too far from EMA — not a pullback

      // RSI not overbought
      const rsi = this.calcRSI(closes, 14);
      if (!rsi || rsi > this.params.rsiOverbought) return null;

      // Breadth confirming
      if (breadth) {
        if (breadth.market_sentiment === 'BEARISH' || breadth.market_sentiment === 'STRONGLY_BEARISH') return null;
        if (breadth.advance_decline_ratio && breadth.advance_decline_ratio < 1.0) return null;
      }

      // Candle showing rejection of lower prices (bullish hammer or close near high)
      const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
      const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
      if (lowerWick < upperWick * 0.5 && lastClose < lastCandle.open) return null;

      return this.buildSignal('LONG', 'CE', lastCandle, regime, breadth, rsi);

    } else {
      // SHORT pullback
      const ema55 = EMA(closes, 55);
      if (!ema55 || lastClose > ema55) return null;

      const pctFromEMA = Math.abs(lastClose - ema21) / ema21 * 100;
      if (pctFromEMA > 5) return null;

      const rsi = this.calcRSI(closes, 14);
      if (!rsi || rsi < this.params.rsiOversold) return null;

      if (breadth) {
        if (breadth.market_sentiment === 'BULLISH' || breadth.market_sentiment === 'STRONGLY_BULLISH') return null;
        if (breadth.advance_decline_ratio && breadth.advance_decline_ratio > 1.0) return null;
      }

      const lowerWick = Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
      const upperWick = lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
      if (upperWick < lowerWick * 0.5 && lastClose > lastCandle.open) return null;

      return this.buildSignal('SHORT', 'PE', lastCandle, regime, breadth, rsi);
    }
  }

  managePosition(position, ctx) {
    const entry = position.entryPrice;
    const current = position.currentPrice;
    const pnlPct = ((current - entry) / entry) * 100 * (position.direction === 'LONG' ? 1 : -1);

    // Hard stop loss
    if (pnlPct <= -this.params.stopLossPct) {
      return { action: 'EXIT', reason: 'stop_loss' };
    }

    // Target (multi-R)
    if (pnlPct >= this.params.targetR * this.params.stopLossPct) {
      return { action: 'EXIT', reason: 'target_hit' };
    }

    // Trailing
    if (pnlPct >= this.params.trailingTriggerPct) {
      const trailFrom = pnlPct - (this.params.trailingTriggerPct / 2);
      return { action: 'TRAIL', trailTo: entry * (1 + trailFrom / 100) };
    }

    return { action: 'HOLD' };
  }

  getDirection(regime) {
    if (!regime) return null;
    if (regime.trend === 'TREND_UP') return 'LONG';
    if (regime.trend === 'TREND_DOWN') return 'SHORT';
    return null;
  }

  calcRSI(closes, period) {
    if (closes.length < period + 1) return null;
    const changes = [];
    for (let i = 1; i <= period; i++) {
      changes.push(closes[closes.length - i] - closes[closes.length - i - 1]);
    }
    const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
    const losses = changes.filter(c => c < 0).reduce((a, b) => a + -b, 0) / period;
    if (losses === 0) return 100;
    const rs = gains / losses;
    return 100 - (100 / (1 + rs));
  }

  buildSignal(direction, optionType, candle, regime, breadth, rsi) {
    const reasons = [];
    reasons.push(`Pullback to EMA21 in ${regime.trend} regime`);
    reasons.push(`RSI: ${rsi?.toFixed(1)}`);
    if (breadth) {
      reasons.push(`Sentiment: ${breadth.market_sentiment}`);
    }

    return {
      symbol: regime?.symbol || 'NIFTY',
      direction,
      action: 'BUY',
      instrument: 'OPTION',
      optionType,
      confidence: Math.round((regime?.confidence || 0.5) * (rsi ? 1 : 0.8) * 100),
      reasons,
      params: {
        stopLossPct: this.params.stopLossPct,
        targetR: this.params.targetR,
        trailingTriggerPct: this.params.trailingTriggerPct,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { TrendPullbackStrategy };
