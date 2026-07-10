const { Pool } = require('pg');
const { ValidationCheckpoints, CHECKPOINTS } = require('./checkpoints');

class PaperCheck {
  constructor(options = {}) {
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.pool = null;
    this.thresholds = CHECKPOINTS.PAPER.thresholds;
  }

  async run() {
    console.log('\n=== Checkpoint: Paper Trading Validation ===\n');
    if (!this.pool) this.pool = new Pool({ connectionString: this.timescaleUrl });

    const trades = await this.fetchPaperTrades();
    const daysActive = this.getDaysActive(trades);
    const metrics = this.computeMetrics(trades);

    console.log(`  Paper mode active for ${daysActive} days`);
    console.log(`  Trades executed: ${metrics.totalTrades}`);
    console.log(`  Avg slippage: ${metrics.avgSlippagePct.toFixed(2)}%`);
    console.log(`  Win rate: ${metrics.winRate.toFixed(1)}%`);
    console.log(`  Total P&L: ${metrics.totalPnl.toFixed(2)}`);

    const errors = [];
    if (daysActive < this.thresholds.minDays.min) {
      errors.push(`Insufficient days: ${daysActive} < ${this.thresholds.minDays.min} (need ${this.thresholds.minDays.min - daysActive} more)`);
    }
    if (metrics.totalTrades < this.thresholds.minTrades.min) {
      errors.push(`Insufficient trades: ${metrics.totalTrades} < ${this.thresholds.minTrades.min}`);
    }
    if (metrics.avgSlippagePct > this.thresholds.maxAvgSlippagePct.max) {
      errors.push(`Avg slippage too high: ${metrics.avgSlippagePct.toFixed(2)}% > ${this.thresholds.maxAvgSlippagePct.max}%`);
    }

    const passed = errors.length === 0;
    const result = { passed, metrics: { daysActive, ...metrics }, errors };

    const cp = new ValidationCheckpoints();
    cp.recordAttempt('paper', result);

    console.log(`\nPaper checkpoint: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Next: ${cp.getCurrentCheckpoint()}\n`);

    if (!result.passed) {
      console.log('Remaining requirements:');
      errors.forEach(e => console.log(`  ✗ ${e}`));
    }

    await this.pool.end();
    return result;
  }

  async fetchPaperTrades() {
    try {
      const res = await this.pool.query(
        `SELECT time, trade_id, strategy_id, pnl, slippage, exit_reason, entry_price, exit_price
         FROM trades WHERE broker = 'paper' ORDER BY time ASC`
      );
      return res.rows.map(r => ({
        time: r.time, tradeId: r.trade_id, strategyId: r.strategy_id,
        pnl: parseFloat(r.pnl) || 0, slippage: parseFloat(r.slippage) || 0,
        exitReason: r.exit_reason, entryPrice: parseFloat(r.entry_price) || 0,
        exitPrice: parseFloat(r.exit_price) || 0,
      }));
    } catch (e) {
      return [];
    }
  }

  getDaysActive(trades) {
    if (trades.length < 2) return 0;
    const first = new Date(trades[0].time);
    const last = new Date(trades[trades.length - 1].time);
    return Math.round((last - first) / 86400000);
  }

  computeMetrics(trades) {
    if (trades.length === 0) return { totalTrades: 0, winRate: 0, avgSlippagePct: 0, totalPnl: 0 };
    const wins = trades.filter(t => t.pnl > 0);
    const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
    const avgSlippage = trades.reduce((s, t) => s + t.slippage, 0) / trades.length;
    const avgEntryPrice = trades.reduce((s, t) => s + t.entryPrice, 0) / trades.length;
    const avgSlippagePct = avgEntryPrice > 0 ? (avgSlippage / avgEntryPrice) * 100 : 0;
    return {
      totalTrades: trades.length,
      winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
      avgSlippagePct,
      totalPnl,
    };
  }
}

async function runCheck() {
  const checker = new PaperCheck();
  return await checker.run();
}

module.exports = { PaperCheck, runCheck };

if (require.main === module) runCheck().catch(err => { console.error(err); process.exit(1); });
