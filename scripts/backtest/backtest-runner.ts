const { Pool } = require('pg');
const { OptionSimulator } = require('./option-simulator');

class BacktestRunner {
  constructor(options = {}) {
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.symbol = options.symbol || 'NIFTY';
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.strategies = options.strategies || [];
    this.regimeData = options.regimeData || null;
    this.breadthData = options.breadthData || null;
    this.optionSim = new OptionSimulator(options.optionSim || {});
    this.pool = null;
  }

  async run() {
    if (!this.pool) this.pool = new Pool({ connectionString: this.timescaleUrl });

    const candles = await this.fetchCandles();
    if (candles.length < 50) throw new Error('Insufficient candle data for backtest');

    const breadth = await this.fetchBreadth();
    const regimeSequence = this.buildRegimeSequence(candles, breadth);

    const results = [];

    for (const strategy of this.strategies) {
      const trades = this.runStrategy(strategy, candles, regimeSequence, breadth);
      const metrics = this.computeMetrics(trades);
      const byRegime = this.groupByRegime(trades);
      results.push({ strategyId: strategy.id, trades, metrics, byRegime });
    }

    await this.pool.end();
    return results;
  }

  async fetchCandles() {
    const lookbackDays = 365;
    const fromDate = this.startDate
      ? new Date(this.startDate)
      : new Date(Date.now() - lookbackDays * 86400000);
    const toDate = this.endDate ? new Date(this.endDate) : new Date();

    const res = await this.pool.query(
      `SELECT time, open, high, low, close, volume FROM candles_1m
       WHERE symbol = $1 AND time >= $2 AND time <= $3
       ORDER BY time ASC`,
      [this.symbol, fromDate.toISOString(), toDate.toISOString()]
    );

    return res.rows.map(r => ({
      time: r.time, open: parseFloat(r.open), high: parseFloat(r.high),
      low: parseFloat(r.low), close: parseFloat(r.close), volume: parseInt(r.volume) || 0,
    }));
  }

  async fetchBreadth() {
    try {
      const res = await this.pool.query(
        `SELECT time, advance_decline_ratio, market_sentiment FROM market_breadth
         ORDER BY time ASC`
      );
      return res.rows.map(r => ({
        time: r.time,
        advance_decline_ratio: parseFloat(r.advance_decline_ratio),
        market_sentiment: r.market_sentiment,
      }));
    } catch (e) {
      return [];
    }
  }

  buildRegimeSequence(candles, breadth) {
    if (!breadth || breadth.length === 0) return [];
    const dailyCandles = this.aggregateDaily(candles);
    return dailyCandles.map(dc => {
      const b = breadth.find(b => {
        const bd = new Date(b.time).toISOString().split('T')[0];
        const cd = new Date(dc.time).toISOString().split('T')[0];
        return bd === cd;
      });
      const atr = this.calcATR(dailyCandles.slice(0, dailyCandles.indexOf(dc) + 1));
      return {
        time: dc.time,
        trend: dc.close > dc.open ? 'TREND_UP' : 'TREND_DOWN',
        strength: Math.abs(dc.close - dc.open) / (dc.high - dc.low || 1),
        volatility: atr && dc.close > 0 ? (atr / dc.close * 100 > 1.5 ? 'HIGH' : 'NORMAL') : 'NORMAL',
        phase: 'TRENDING',
        tradeableTiers: ['T1', 'T2'],
        breadthState: b ? { advance_decline_ratio: b.advance_decline_ratio, market_sentiment: b.market_sentiment } : null,
      };
    });
  }

  runStrategy(strategy, candles, regimeSequence, breadth) {
    const trades = [];
    let position = null;
    const triggerCandles = this.aggregateToTF(candles, strategy.params?.triggerTF || '5m');

    for (let i = 20; i < triggerCandles.length; i++) {
      const slice = triggerCandles.slice(0, i + 1);
      const current = triggerCandles[i];

      const regime = this.findRegimeAt(regimeSequence, current.time);
      const breadthAt = this.findBreadthAt(breadth, current.time);

      const ctx = {
        candles: { [strategy.params?.triggerTF || '5m']: slice },
        regime,
        breadth: breadthAt,
      };

      if (!position) {
        const signal = strategy.evaluateEntry(ctx);
        if (signal) {
          position = {
            ...signal,
            entryTime: current.time,
            entryPrice: current.close,
            exitTime: null,
            exitPrice: null,
            pnl: null,
            status: 'OPEN',
          };
        }
      } else {
        const mgmt = strategy.managePosition(position, ctx);
        if (mgmt.action === 'EXIT' || mgmt.action === 'TRAIL') {
          position.exitTime = current.time;
          position.exitPrice = current.close;
          position.exitReason = mgmt.reason || mgmt.action;
          position.status = 'CLOSED';

          const optionResult = this.optionSim.simulateTrade(position, {
            entry: { price: position.entryPrice, time: position.entryTime },
            exit: { price: position.exitPrice, time: position.exitTime },
            expiry: this.nextWeeklyExpiry(position.entryTime),
          });
          position.optionResult = optionResult;
          position.pnl = optionResult.pnl;
          trades.push(position);
          position = null;
        }
      }
    }

    if (position && position.status === 'OPEN') {
      position.exitTime = triggerCandles[triggerCandles.length - 1].time;
      position.exitPrice = triggerCandles[triggerCandles.length - 1].close;
      position.exitReason = 'end_of_test';
      position.status = 'CLOSED';
      const optionResult = this.optionSim.simulateTrade(position, {
        entry: { price: position.entryPrice, time: position.entryTime },
        exit: { price: position.exitPrice, time: position.exitTime },
        expiry: this.nextWeeklyExpiry(position.entryTime),
      });
      position.optionResult = optionResult;
      position.pnl = optionResult.pnl;
      trades.push(position);
    }

    return trades;
  }

  // Every metric below is computed from OptionSimulator's synthetic (Black-Scholes,
  // constant-IV) premiums — see scripts/backtest/option-simulator.js. The result carries
  // `synthetic: true` so no report can present these as realised P&L. Rule 13.
  computeMetrics(trades) {
    if (trades.length === 0) return { total: 0, synthetic: true, pricing: 'black-scholes-const-iv' };

    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    const returns = trades.map(t => t.pnl);
    const avgReturn = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;
    for (const t of trades) {
      cumulative += t.pnl;
      if (cumulative > peak) peak = cumulative;
      const dd = peak - cumulative;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }

    return {
      total: trades.length,
      wins: wins.length,
      losses: losses.length,
      winRate: trades.length > 0 ? wins.length / trades.length : 0,
      totalPnl: Math.round(totalPnl * 100) / 100,
      grossProfit: Math.round(grossProfit * 100) / 100,
      grossLoss: Math.round(grossLoss * 100) / 100,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      expectancy: trades.length > 0 ? Math.round((totalPnl / trades.length) * 100) / 100 : 0,
      sharpe: stdDev > 0 ? Math.round((avgReturn / stdDev) * Math.sqrt(252) * 100) / 100 : 0,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      synthetic: true,                       // Rule 13: model-priced, not real fills
      pricing: 'black-scholes-const-iv',
    };
  }

  groupByRegime(trades) {
    const groups = {};
    for (const t of trades) {
      const regime = t.regime?.trend || 'UNKNOWN';
      if (!groups[regime]) groups[regime] = [];
      groups[regime].push(t);
    }
    const result = {};
    for (const [regime, regTrades] of Object.entries(groups)) {
      result[regime] = this.computeMetrics(regTrades);
    }
    return result;
  }

  aggregateToTF(candles, tf) {
    const mins = parseInt(tf) || 5;
    const buckets = new Map();
    for (const c of candles) {
      const bucket = Math.floor(new Date(c.time).getTime() / (mins * 60000)) * (mins * 60000);
      if (!buckets.has(bucket)) {
        buckets.set(bucket, { time: new Date(bucket), open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume });
      } else {
        const b = buckets.get(bucket);
        b.high = Math.max(b.high, c.high);
        b.low = Math.min(b.low, c.low);
        b.close = c.close;
        b.volume += c.volume;
      }
    }
    return Array.from(buckets.values()).sort((a, b) => a.time - b.time);
  }

  aggregateDaily(candles) {
    return this.aggregateToTF(candles, 1440);
  }

  calcATR(candles, period = 14) {
    if (candles.length < period + 1) return null;
    const trs = [];
    for (let i = 1; i < candles.length; i++) {
      const tr = Math.max(candles[i].high - candles[i].low, Math.abs(candles[i].high - candles[i - 1].close), Math.abs(candles[i].low - candles[i - 1].close));
      trs.push(tr);
    }
    const first = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let atr = first;
    for (let i = period; i < trs.length; i++) atr = (trs[i] + atr * (period - 1)) / period;
    return atr;
  }

  nextWeeklyExpiry(fromDate) {
    const d = new Date(fromDate);
    const targetDay = 2;
    const currentDay = d.getDay();
    const diff = (targetDay + 7 - currentDay) % 7;
    d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
    return d.toISOString().split('T')[0];
  }

  findRegimeAt(regimeSequence, time) {
    if (!regimeSequence || regimeSequence.length === 0) return null;
    const t = new Date(time).getTime();
    let best = null;
    for (const r of regimeSequence) {
      const rt = new Date(r.time).getTime();
      if (rt <= t) best = r;
      else break;
    }
    return best;
  }

  findBreadthAt(breadth, time) {
    if (!breadth || breadth.length === 0) return null;
    const t = new Date(time).getTime();
    let best = null;
    for (const b of breadth) {
      const bt = new Date(b.time).getTime();
      if (bt <= t) best = b;
      else break;
    }
    return best;
  }
}

async function runBacktest(options) {
  const runner = new BacktestRunner(options);
  return await runner.run();
}

module.exports = { BacktestRunner, runBacktest };
