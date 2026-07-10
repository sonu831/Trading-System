const { BaseStrategy } = require('../base');
const { SMA, EMA, ATR } = require('../../regime/indicators');

class MomentumBurstStrategy extends BaseStrategy {
  constructor() {
    super({
      id: 'momentum-burst',
      version: '1.0',
      tier: 'T1',
      description: 'Scalp momentum bursts on 5m expansion candles with breadth confirmation (§3.6)',
      regimeAffinity: ['TREND_UP', 'TREND_DOWN'],
      params: {
        triggerTF: '5m',
        contextTF: '15m',
        atrMultiplier: 1.5,
        minVolumeRatio: 1.2,
        rsiEntryMin: 55,
        rsiEntryMax: 75,
        rsiBearishMax: 45,
        rsiBearishMin: 25,
        closeInTopPct: 25,
        notExtendedMultiplier: 2.0,
        stopLossPct: 18,
        targetPct: 30,
        trailingTriggerPct: 12,
        trailingStepPct: 6,
        timeStopMinutes: 10,
        highVolOk: false,
      },
    });
  }

  evaluateEntry(ctx) {
    const { candles, regime, breadth } = ctx;
    const tf = this.params.triggerTF;
    const triggerCandles = candles[tf];

    if (!triggerCandles || triggerCandles.length < 20) return null;

    const lastCandle = triggerCandles[triggerCandles.length - 1];
    const closes = triggerCandles.map(c => c.close);
    const lastClose = lastCandle.close;

    // 1. Regime check (already filtered by router, but double-check)
    const direction = this.getDirection(regime);
    if (!direction) return null;

    // 2. Range check — candle must be an expansion
    const atr14 = ATR(triggerCandles, 14);
    if (!atr14 || atr14 <= 0) return null;
    const candleRange = lastCandle.high - lastCandle.low;
    if (candleRange < this.params.atrMultiplier * atr14) return null;

    // 3. Close position check — must close in top/bottom of range
    const rangePct = lastClose > lastCandle.low
      ? ((lastClose - lastCandle.low) / (lastCandle.high - lastCandle.low)) * 100
      : 50;
    if (direction === 'LONG' && rangePct < (100 - this.params.closeInTopPct)) return null;
    if (direction === 'SHORT' && rangePct > this.params.closeInTopPct) return null;

    // 4. Volume check
    const avgVolume = SMA(triggerCandles.map(c => c.volume), 20);
    if (avgVolume && avgVolume > 0 && lastCandle.volume < this.params.minVolumeRatio * avgVolume) return null;

    if (direction === 'LONG') {
      // 5. Structure break — above swing high, VWAP, EMA21
      const ema21 = EMA(closes, 21);
      if (!ema21 || lastClose <= ema21) return null;

      if (closes.length >= 10) {
        const recentHigh = Math.max(...closes.slice(-10, -1));
        if (lastClose <= recentHigh) return null;
      }

      // 6. RSI entry gate — rising but not exhausted
      const rsi = this.calcRSI(closes, 14);
      if (!rsi || rsi < this.params.rsiEntryMin || rsi > this.params.rsiEntryMax) return null;

      // 7. Not extended — price not too far above VWAP
      const vwap = this.calcVWAP(triggerCandles);
      if (vwap && (lastClose - vwap) > this.params.notExtendedMultiplier * atr14) return null;

      // 8. Breadth confirming
      if (breadth) {
        if (breadth.advance_decline_ratio && breadth.advance_decline_ratio <= 1.2) return null;
        if (breadth.market_sentiment === 'BEARISH' || breadth.market_sentiment === 'STRONGLY_BEARISH') return null;
      }

      return this.buildSignal('LONG', 'CE', lastCandle, regime, breadth);

    } else {
      // SHORT — mirror of LONG
      const ema21 = EMA(closes, 21);
      if (!ema21 || lastClose >= ema21) return null;

      if (closes.length >= 10) {
        const recentLow = Math.min(...closes.slice(-10, -1));
        if (lastClose >= recentLow) return null;
      }

      const rsi = this.calcRSI(closes, 14);
      if (!rsi || rsi > this.params.rsiBearishMax || rsi < this.params.rsiBearishMin) return null;

      if (breadth) {
        if (breadth.advance_decline_ratio && breadth.advance_decline_ratio >= 0.8) return null;
        if (breadth.market_sentiment === 'BULLISH' || breadth.market_sentiment === 'STRONGLY_BULLISH') return null;
      }

      return this.buildSignal('SHORT', 'PE', lastCandle, regime, breadth);
    }
  }

  managePosition(position, ctx) {
    const entry = position.entryPrice;
    const current = position.currentPrice;
    const pnlPct = ((current - entry) / entry) * 100 * (position.direction === 'LONG' ? 1 : -1);

    // Time stop
    const elapsed = (Date.now() - new Date(position.entryTime).getTime()) / 60000;
    if (elapsed > this.params.timeStopMinutes && Math.abs(pnlPct) < 5) {
      return { action: 'EXIT', reason: 'time_stop' };
    }

    // Hard stop loss
    if (pnlPct <= -this.params.stopLossPct) {
      return { action: 'EXIT', reason: 'stop_loss' };
    }

    // Target hit
    if (pnlPct >= this.params.targetPct) {
      return { action: 'EXIT', reason: 'target_hit' };
    }

    // Trailing stop
    if (pnlPct >= this.params.trailingTriggerPct) {
      const trailFrom = pnlPct - this.params.trailingStepPct;
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

  calcVWAP(candles) {
    let pvSum = 0, volSum = 0;
    for (const c of candles) {
      const tp = (c.high + c.low + c.close) / 3;
      pvSum += tp * c.volume;
      volSum += c.volume;
    }
    return volSum > 0 ? pvSum / volSum : null;
  }

  buildSignal(direction, optionType, candle, regime, breadth) {
    const reasons = [];
    reasons.push(`Momentum burst: range ${((candle.high - candle.low) / (candle.close || 1) * 100).toFixed(1)}%`);
    reasons.push(`Close in ${direction === 'LONG' ? 'top' : 'bottom'} of range`);

    if (breadth) {
      reasons.push(`Breadth A/D: ${breadth.advance_decline_ratio?.toFixed(2) || 'N/A'}`);
    }

    return {
      symbol: regime?.symbol || 'NIFTY',
      direction,
      action: 'BUY',
      instrument: 'OPTION',
      optionType,
      confidence: Math.round(regime?.confidence || 0.5) * 100,
      reasons,
      params: {
        stopLossPct: this.params.stopLossPct,
        targetPct: this.params.targetPct,
        trailingTriggerPct: this.params.trailingTriggerPct,
        trailingStepPct: this.params.trailingStepPct,
        timeStopMinutes: this.params.timeStopMinutes,
      },
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { MomentumBurstStrategy };
