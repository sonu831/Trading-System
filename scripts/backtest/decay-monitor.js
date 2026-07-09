const { Pool } = require('pg');

class DecayMonitor {
  constructor(options = {}) {
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.pool = null;
    this.baselines = {};
    this.threshold = options.threshold || 0.5;
    this.windowTrades = options.windowTrades || 20;
  }

  async loadBaseline(strategyId, baselineMetrics) {
    this.baselines[strategyId] = baselineMetrics;
  }

  async loadBaselineFromBacktest(strategyId, backtestResult) {
    this.baselines[strategyId] = backtestResult;
  }

  async checkDecay(strategyId, liveTrades) {
    const baseline = this.baselines[strategyId];
    if (!baseline) return { decayed: false, reason: 'no_baseline' };

    if (liveTrades.length < this.windowTrades) return { decayed: false, reason: 'insufficient_trades', count: liveTrades.length };

    const liveMetrics = this.computeMetrics(liveTrades);
    const baselineExp = baseline.expectancy || 0;
    const liveExp = liveMetrics.expectancy || 0;

    const drift = baselineExp > 0 ? (liveExp - baselineExp) / Math.abs(baselineExp) : liveExp - baselineExp;

    const decayed = drift < -this.threshold;
    const severity = decayed ? (drift < -1 ? 'CRITICAL' : 'WARNING') : 'OK';

    return {
      strategyId,
      decayed,
      severity,
      drift: Math.round(drift * 100) / 100,
      baseline: { expectancy: baselineExp, winRate: baseline.winRate },
      live: { expectancy: liveExp, winRate: liveMetrics.winRate, count: liveTrades.length },
      timestamp: new Date().toISOString(),
    };
  }

  async checkAllStrategies(strategies) {
    if (!this.pool) this.pool = new Pool({ connectionString: this.timescaleUrl });

    const results = {};
    for (const [strategyId, baseline] of Object.entries(this.baselines)) {
      const liveTrades = await this.fetchRecentTrades(strategyId);
      results[strategyId] = await this.checkDecay(strategyId, liveTrades);
    }
    return results;
  }

  async fetchRecentTrades(strategyId) {
    try {
      const res = await this.pool.query(
        `SELECT time, trade_id, strategy_id, pnl, entry_price, exit_price, exit_reason
         FROM trades
         WHERE strategy_id = $1
         ORDER BY time DESC
         LIMIT $2`,
        [strategyId, this.windowTrades * 2]
      );
      return res.rows.map(r => ({
        pnl: parseFloat(r.pnl) || 0,
        entryPrice: parseFloat(r.entry_price) || 0,
        exitPrice: parseFloat(r.exit_price) || 0,
        time: r.time,
        exitReason: r.exit_reason,
      }));
    } catch (e) {
      return [];
    }
  }

  computeMetrics(trades) {
    if (trades.length === 0) return {};
    const wins = trades.filter(t => t.pnl > 0);
    const losses = trades.filter(t => t.pnl <= 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    return {
      total: trades.length,
      winRate: wins.length / trades.length,
      expectancy: totalPnl / trades.length,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    };
  }
}

module.exports = { DecayMonitor };
