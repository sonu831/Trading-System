const { Pool } = require('pg');
const { ValidationCheckpoints, CHECKPOINTS } = require('./checkpoints');

class ShadowCheck {
  constructor(options = {}) {
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.pool = null;
    this.thresholds = CHECKPOINTS.SHADOW.thresholds;
  }

  async run() {
    console.log('\n=== Checkpoint: Shadow Trading Validation ===\n');
    if (!this.pool) this.pool = new Pool({ connectionString: this.timescaleUrl });

    const shadowLog = await this.fetchShadowLog();
    const daysActive = this.getDaysActive(shadowLog);
    const metrics = this.computeMetrics(shadowLog);

    console.log(`  Shadow mode active for ${daysActive} days`);
    console.log(`  Signals generated: ${metrics.totalSignals}`);
    console.log(`  Manual trades taken: ${metrics.totalManual}`);
    console.log(`  Shadow accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
    console.log(`  Manual P&L: ${metrics.manualPnl.toFixed(2)}`);

    const errors = [];
    if (daysActive < this.thresholds.minDays.min) {
      errors.push(`Insufficient days: ${daysActive} < ${this.thresholds.minDays.min}`);
    }
    if (metrics.totalManual < this.thresholds.minTrades.min) {
      errors.push(`Insufficient manual trades: ${metrics.totalManual} < ${this.thresholds.minTrades.min}`);
    }
    if (metrics.accuracy < this.thresholds.shadowAccuracy.min) {
      errors.push(`Shadow accuracy too low: ${(metrics.accuracy * 100).toFixed(1)}% < ${this.thresholds.shadowAccuracy.min * 100}%`);
    }

    const passed = errors.length === 0;
    const result = { passed, metrics: { daysActive, ...metrics }, errors };

    const cp = new ValidationCheckpoints();
    cp.recordAttempt('shadow', result);

    console.log(`\nShadow checkpoint: ${result.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Next: ${cp.getCurrentCheckpoint()}\n`);

    if (!result.passed) {
      console.log('Remaining requirements:');
      errors.forEach(e => console.log(`  ✗ ${e}`));
    }

    await this.pool.end();
    return result;
  }

  async fetchShadowLog() {
    try {
      const res = await this.pool.query(
        `SELECT time, trade_id, strategy_id, entry_price, exit_price, pnl, exit_reason
         FROM trades WHERE broker = 'shadow' ORDER BY time ASC`
      );
      return res.rows.map(r => ({
        time: r.time, tradeId: r.trade_id, strategyId: r.strategy_id,
        entryPrice: parseFloat(r.entry_price) || 0,
        exitPrice: parseFloat(r.exit_price) || 0,
        pnl: parseFloat(r.pnl) || 0,
        exitReason: r.exit_reason,
      }));
    } catch (e) {
      return [];
    }
  }

  getDaysActive(log) {
    if (log.length < 2) return 0;
    const first = new Date(log[0].time);
    const last = new Date(log[log.length - 1].time);
    return Math.round((last - first) / 86400000);
  }

  computeMetrics(log) {
    const totalSignals = log.length;
    const manualTrades = log.filter(t => t.exitReason !== 'shadow_skip');
    const totalManual = manualTrades.length;
    const manualPnl = manualTrades.reduce((s, t) => s + t.pnl, 0);
    const wins = manualTrades.filter(t => t.pnl > 0);
    const accuracy = totalManual > 0 ? wins.length / totalManual : 0;
    return { totalSignals, totalManual, accuracy, manualPnl };
  }
}

async function runCheck() {
  const checker = new ShadowCheck();
  return await checker.run();
}

module.exports = { ShadowCheck, runCheck };

if (require.main === module) runCheck().catch(err => { console.error(err); process.exit(1); });
