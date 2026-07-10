const { Pool } = require('pg');
const { ValidationCheckpoints, CHECKPOINTS } = require('./checkpoints');

class BacktestCheck {
  constructor(options = {}) {
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.thresholds = CHECKPOINTS.BACKTEST.thresholds;
    this.pool = null;
  }

  async run(strategies) {
    console.log('\n=== Checkpoint: Backtest Validation ===\n');
    const results = [];

    for (const strategy of strategies) {
      console.log(`Running backtest for ${strategy.id}...`);
      const { runBacktest } = require('../backtest/backtest-runner');
      const btResults = await runBacktest({
        timescaleUrl: this.timescaleUrl,
        strategies: [strategy],
        startDate: this.getDefaultStartDate(),
      });

      if (!btResults || btResults.length === 0) {
        results.push({ strategyId: strategy.id, passed: false, errors: ['Backtest returned no results'] });
        continue;
      }

      const r = btResults[0];
      const metrics = {
        profitFactor: r.metrics.profitFactor || 0,
        expectancy: r.metrics.expectancy || 0,
        totalTrades: r.metrics.total || 0,
      };

      const errors = [];
      if (metrics.totalTrades < this.thresholds.minTrades.min) {
        errors.push(`Insufficient trades: ${metrics.totalTrades} < ${this.thresholds.minTrades.min}`);
      }
      if (metrics.profitFactor < this.thresholds.profitFactor.min) {
        errors.push(`Profit factor too low: ${metrics.profitFactor.toFixed(2)} < ${this.thresholds.profitFactor.min}`);
      }
      if (metrics.expectancy < this.thresholds.expectancy.min) {
        errors.push(`Expectancy too low: ${metrics.expectancy.toFixed(2)} < ${this.thresholds.expectancy.min}`);
      }

      const passed = errors.length === 0;
      results.push({
        strategyId: strategy.id,
        passed,
        metrics,
        errors,
        byRegime: r.byRegime,
      });

      console.log(`  ${strategy.id}: ${metrics.totalTrades} trades, PF ${metrics.profitFactor.toFixed(2)}, Exp ${metrics.expectancy.toFixed(2)}R — ${passed ? 'PASS' : 'FAIL'}`);
      if (errors.length > 0) errors.forEach(e => console.log(`    ✗ ${e}`));
    }

    // Overall checkpoint passes if ALL strategies pass
    const allPassed = results.every(r => r.passed);
    return {
      passed: allPassed,
      metrics: { strategies: results },
      errors: results.filter(r => !r.passed).flatMap(r => r.errors),
    };
  }

  getDefaultStartDate() {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split('T')[0];
  }
}

async function runCheck() {
  const { MomentumBurstStrategy } = require('../../layer-6-signal/src/strategies/plugins/momentum-burst');
  const { TrendPullbackStrategy } = require('../../layer-6-signal/src/strategies/plugins/trend-pullback');

  const checker = new BacktestCheck();
  const strategies = [new MomentumBurstStrategy(), new TrendPullbackStrategy()];
  const result = await checker.run(strategies);

  const cp = new ValidationCheckpoints();
  cp.recordAttempt('backtest', result);

  console.log(`\nBacktest checkpoint: ${result.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`Next: ${cp.getCurrentCheckpoint()}\n`);

  return result;
}

module.exports = { BacktestCheck, runCheck };

if (require.main === module) runCheck().catch(err => { console.error(err); process.exit(1); });
