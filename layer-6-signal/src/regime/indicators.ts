/**
 * Technical indicators for regime detection.
 * Pure functions — no side effects, no I/O. Fully testable.
 */

interface Candle {
  high: number;
  low: number;
  close: number;
}

interface TrendResult {
  trend: string;
  strength: number;
  adx: number;
  score: number;
}

interface ADXResult {
  ADX: number;
  PDI: number;
  NDI: number;
}

interface TFAlignmentInput {
  [timeframe: string]: string;
}

export function SMA(data: number[], period: number): number | null {
  if (!data || data.length < period) return null;
  let sum = 0;
  for (let i = data.length - period; i < data.length; i++) sum += data[i];
  return sum / period;
}

export function EMA(data: number[], period: number): number | null {
  if (!data || data.length < period) return SMA(data, period);
  const sma = SMA(data.slice(0, period), period);
  if (sma == null) return null;
  const multiplier = 2 / (period + 1);
  let ema = sma;
  for (let i = period; i < data.length; i++) {
    ema = (data[i] - ema) * multiplier + ema;
  }
  return ema;
}

export function ATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (!highs || highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );
    trs.push(tr);
  }
  if (trs.length < period) return null;
  const first = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let atr = first;
  for (let i = period; i < trs.length; i++) {
    atr = (trs[i] + atr * (period - 1)) / period;
  }
  return atr;
}

export function ADX(highs: number[], lows: number[], closes: number[], period = 14): ADXResult | null {
  if (!highs || highs.length < period + 1) return null;
  const n = highs.length;
  const trs: number[] = [];
  const pdm: number[] = [];
  const ndm: number[] = [];
  for (let i = 1; i < n; i++) {
    const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1]));
    trs.push(tr);
    const up = highs[i] - highs[i-1];
    const down = lows[i-1] - lows[i];
    pdm.push(up > down && up > 0 ? up : 0);
    ndm.push(down > up && down > 0 ? down : 0);
  }
  const wilder = (arr: number[], p: number): number[] => {
    const r: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      if (i < p - 1) continue;
      if (i === p - 1) r.push(arr.slice(0, p).reduce((a, b) => a + b, 0) / p);
      else r.push((arr[i] + r[r.length - 1] * (p - 1)) / p);
    }
    return r;
  };
  const atrS = wilder(trs, period);
  const pdiS = wilder(pdm, period);
  const ndiS = wilder(ndm, period);
  if (!atrS.length) return null;
  const dxValues: number[] = [];
  for (let i = 0; i < atrS.length; i++) {
    if (atrS[i] === 0) { dxValues.push(0); continue; }
    const pdi = (pdiS[i] / atrS[i]) * 100;
    const ndi = (ndiS[i] / atrS[i]) * 100;
    const dx = (Math.abs(pdi - ndi) / (pdi + ndi)) * 100;
    dxValues.push(dx);
  }
  const count = Math.min(period, dxValues.length);
  const adx = count > 0 ? dxValues.slice(-count).reduce((a, b) => a + b, 0) / count : 0;
  const last = atrS.length - 1;
  return {
    ADX: adx,
    PDI: atrS[last] > 0 ? (pdiS[last] / atrS[last]) * 100 : 0,
    NDI: atrS[last] > 0 ? (ndiS[last] / atrS[last]) * 100 : 0,
  };
}

export function detectTrend(highs: number[], lows: number[], closes: number[]): TrendResult {
  const adxR = ADX(highs, lows, closes, 14);
  const adx = adxR?.ADX ?? 0;
  const ema9 = EMA(closes, 9) ?? 0;
  const ema21 = EMA(closes, 21) ?? 0;
  const ema55 = EMA(closes, 55) ?? 0;
  let score = 0;
  if (ema9 > ema21) score += 1; else if (ema9 < ema21) score -= 1;
  if (ema21 > ema55) score += 1; else if (ema21 < ema55) score -= 1;
  const momentum = closes.length >= 5 ? (closes[closes.length - 1] - closes[closes.length - 5]) / closes[closes.length - 5] : 0;
  if (momentum > 0.01) score += 1; else if (momentum < -0.01) score -= 1;
  const trend = adx > 25 ? (score > 0 ? 'TREND_UP' : 'TREND_DOWN') : 'RANGE';
  const strength = Math.min(1, adx / 50) * Math.min(1, Math.abs(score) / 3);
  return { trend, strength, adx, score };
}

export function detectVolatility(highs: number[], lows: number[], closes: number[], vix?: number | null): string {
  const atr = ATR(highs, lows, closes, 14);
  if (atr == null || closes.length === 0) return 'NORMAL';
  const atrPct = atr / closes[closes.length - 1] * 100;
  if (vix != null && vix > 30) return 'HIGH';
  if (atrPct > 2) return 'HIGH';
  if (atrPct < 0.5) return 'LOW';
  return 'NORMAL';
}

export function detectPhase(closes: number[]): string {
  if (closes.length < 60) return 'CONSOLIDATING';
  const ema55 = EMA(closes, 55) ?? closes[closes.length - 1];
  const price = closes[closes.length - 1];
  const deviation = Math.abs(price - ema55) / ema55;
  if (deviation > 0.05) return 'EXHAUSTION';
  const recent10 = closes.slice(-10);
  const range10 = Math.max(...recent10) - Math.min(...recent10);
  const avgPrice = recent10.reduce((a, b) => a + b, 0) / 10;
  if (range10 / avgPrice > 0.03) return 'BREAKOUT';
  const ema21 = EMA(closes, 21) ?? price;
  if (Math.abs(price - ema21) / ema21 < 0.01) return 'CONSOLIDATING';
  return 'TRENDING';
}

/**
 * Net directional consensus across timeframes, in [0, 1].
 *
 * 1.0 = every timeframe trends the same way. 0.0 = perfectly opposed, or nothing trends.
 * Opposing timeframes cancel; RANGE timeframes dilute (a flat timeframe confirms nothing).
 *
 * The previous formula was `max(up, down) / (total - range)`, which divided by the
 * TRENDING timeframes only. One timeframe up with three ranging scored 1/1.001 ≈ 0.999 —
 * near-perfect "alignment" from a single timeframe, enough to green-light a positional
 * trade on no consensus whatsoever.
 */
export function computeTFAlignment(tfVectors: TFAlignmentInput): number {
  const values = Object.values(tfVectors);
  if (values.length === 0) return 0;
  const up = values.filter(v => v === 'TREND_UP').length;
  const down = values.filter(v => v === 'TREND_DOWN').length;
  const net = Math.abs(up - down) / values.length;
  return Math.min(1, Math.max(0, net));
}

export default { SMA, EMA, ATR, ADX, detectTrend, detectVolatility, detectPhase, computeTFAlignment };
