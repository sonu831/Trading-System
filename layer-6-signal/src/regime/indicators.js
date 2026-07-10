const logger = require('../utils/logger');

function SMA(data, period) {
  if (data.length < period) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) sum += data[i];
  return sum / period;
}

function EMA(data, period) {
  if (data.length < period) return SMA(data, period);
  const multiplier = 2 / (period + 1);
  let ema = SMA(data.slice(0, period), period);
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

function ATR(candles, period = 14) {
  if (candles.length < period + 1) return null;
  let trs = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
  }
  const first = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let atr = first;
  for (let i = period; i < trs.length; i++) {
    atr = (trs[i] + atr * (period - 1)) / period;
  }
  return atr;
}

function ADX(candles, period = 14) {
  if (candles.length < period + 1) return null;
  const trs = [];
  const upMoves = [];
  const downMoves = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevHigh = candles[i - 1].high;
    const prevLow = candles[i - 1].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trs.push(tr);
    upMoves.push(high - prevHigh);
    downMoves.push(prevLow - low);
  }
  const smoothWilder = (vals, p) => {
    const first = vals.slice(0, p).reduce((a, b) => a + b, 0) / p;
    let smoothed = first;
    for (let i = p; i < vals.length; i++) {
      smoothed = (vals[i] + smoothed * (p - 1)) / p;
    }
    return smoothed;
  };
  const atrVal = smoothWilder(trs, period);
  if (!atrVal || atrVal === 0) return null;
  const smoothUp = smoothWilder(upMoves, period);
  const smoothDown = smoothWilder(downMoves, period);
  const pdi = (smoothUp / atrVal) * 100;
  const ndi = (smoothDown / atrVal) * 100;
  const dx = Math.abs(pdi - ndi) / (pdi + ndi) * 100;
  return dx;
}

function isBullishEMA(close, ema9, ema21) {
  if (ema9 === null || ema21 === null || close === null) return null;
  return close > ema9 && ema9 > ema21;
}

function isBearishEMA(close, ema9, ema21) {
  if (ema9 === null || ema21 === null || close === null) return null;
  return close < ema9 && ema9 < ema21;
}

function detectTrend(candles, period = 20) {
  const closes = candles.map(c => c.close);
  const ema9 = EMA(closes, 9);
  const ema21 = EMA(closes, 21);
  const ema55 = EMA(closes, 55);
  const lastClose = closes[closes.length - 1];
  const adx = ADX(candles, 14);

  if (adx === null || ema9 === null) return { trend: 'RANGE', strength: 0, adx: 0 };

  let score = 0;
  const bullishEMA = isBullishEMA(lastClose, ema9, ema21);
  const bearishEMA = isBearishEMA(lastClose, ema9, ema21);

  // EMA alignment score
  if (bullishEMA) score += 0.3;
  else if (bearishEMA) score -= 0.3;

  if (ema55 !== null) {
    if (lastClose > ema55 && ema9 > ema55) score += 0.2;
    else if (lastClose < ema55 && ema9 < ema55) score -= 0.2;
  }

  // ADX score
  if (adx > 25) {
    score += score > 0 ? 0.2 : -0.2;
  }

  // Price momentum — last 5 closes slope
  if (closes.length >= 10) {
    const recent5 = closes.slice(-5);
    const prev5 = closes.slice(-10, -5);
    const avgRecent = recent5.reduce((a, b) => a + b, 0) / 5;
    const avgPrev = prev5.reduce((a, b) => a + b, 0) / 5;
    if (avgRecent > avgPrev) score += score >= 0 ? 0.15 : -0.1;
    else score += score <= 0 ? 0.15 : -0.1;
  }

  // Clamp strength
  const strength = Math.min(1, Math.max(0, Math.abs(score)));
  let trend;
  if (adx < 20) trend = 'RANGE';
  else if (score > 0.3) trend = 'TREND_UP';
  else if (score < -0.3) trend = 'TREND_DOWN';
  else trend = 'RANGE';

  return { trend, strength, adx, score };
}

function detectVolatility(candles, vixValue = null) {
  const atr14 = ATR(candles, 14);
  if (atr14 === null || candles.length < 20) return 'NORMAL';

  const closes = candles.map(c => c.close);
  const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
  if (avgClose === 0) return 'NORMAL';

  const atrPct = (atr14 / avgClose) * 100;

  let vol = 'NORMAL';
  if (atrPct > 1.5 || (vixValue && vixValue > 25)) vol = 'HIGH';
  else if (atrPct < 0.5 || (vixValue && vixValue < 12)) vol = 'LOW';

  return vol;
}

function detectPhase(trend, strength, volatility, candles) {
  if (trend === 'RANGE') return 'CONSOLIDATING';
  if (strength < 0.4) return 'CONSOLIDATING';

  const closes = candles.map(c => c.close);
  if (closes.length < 10) return 'TRENDING';

  // Check for exhaustion: price extended from EMA55
  const ema55 = EMA(closes, 55);
  if (ema55 !== null) {
    const lastClose = closes[closes.length - 1];
    const pctFromEMA = Math.abs(lastClose - ema55) / ema55 * 100;
    if (pctFromEMA > 5 && strength > 0.6) return 'EXHAUSTION';
  }

  // Check for breakout: recent expansion
  if (closes.length >= 20) {
    const recentRange = Math.max(...closes.slice(-5)) - Math.min(...closes.slice(-5));
    const avgRange = (Math.max(...closes.slice(-20)) - Math.min(...closes.slice(-20))) / 4;
    if (avgRange > 0 && recentRange > avgRange * 1.5 && strength > 0.5) return 'BREAKOUT';
  }

  return 'TRENDING';
}

function computeTFAlignment(tfResults) {
  const alignment = {};
  let agreementScore = 0;
  let count = 0;

  for (const [tf, result] of Object.entries(tfResults)) {
    if (result.trend === 'TREND_UP') {
      alignment[tf] = 1;
      agreementScore += 1;
      count++;
    } else if (result.trend === 'TREND_DOWN') {
      alignment[tf] = -1;
      agreementScore -= 1;
      count++;
    } else {
      alignment[tf] = 0;
      count++;
    }
  }

  const avgAgreement = count > 0 ? agreementScore / count : 0;
  const confidence = Math.min(1, Math.abs(avgAgreement));

  return { alignment, confidence };
}

module.exports = {
  SMA, EMA, ATR, ADX,
  detectTrend, detectVolatility, detectPhase, computeTFAlignment,
};
