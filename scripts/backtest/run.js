require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { runBacktest } = require('./backtest-runner');
const { runOptimization } = require('./optimizer');
const { MomentumBurstStrategy } = require('../../layer-6-signal/src/strategies/plugins/momentum-burst');
const { TrendPullbackStrategy } = require('../../layer-6-signal/src/strategies/plugins/trend-pullback');
const { PromotionManager } = require('./promotion-manager');

const MODE = process.argv[2] || 'backtest';
const STRATEGY = process.argv[3] || 'momentum-burst';

async function main() {
  console.log(`\n=== Backtest Runner ===`);
  console.log(`Mode: ${MODE}`);
  console.log(`Strategy: ${STRATEGY}\n`);

  const strategies = [];
  if (STRATEGY === 'all' || STRATEGY === 'momentum-burst') strategies.push(new MomentumBurstStrategy());
  if (STRATEGY === 'all' || STRATEGY === 'trend-pullback') strategies.push(new TrendPullbackStrategy());

  if (MODE === 'backtest') {
    const results = await runBacktest({ strategies });
    for (const r of results) {
      console.log(`\n--- ${r.strategyId} ---`);
      console.log(`Trades: ${r.metrics.total} | Win: ${(r.metrics.winRate * 100).toFixed(1)}%`);
      console.log(`P&L: ${r.metrics.totalPnl} | PF: ${r.metrics.profitFactor.toFixed(2)}`);
      console.log(`Expectancy: ${r.metrics.expectancy.toFixed(2)}R`);
      console.log(`Sharpe: ${r.metrics.sharpe.toFixed(2)} | DD: ${r.metrics.maxDrawdown.toFixed(2)}`);

      if (Object.keys(r.byRegime).length > 0) {
        console.log(`\n  By Regime:`);
        for (const [regime, m] of Object.entries(r.byRegime)) {
          console.log(`    ${regime}: ${m.total} trades, PF ${m.profitFactor.toFixed(2)}, Exp ${m.expectancy.toFixed(2)}`);
        }
      }
    }
  }

  if (MODE === 'optimize') {
    const paramGrid = {
      stopLossPct: [12, 15, 18, 22, 25],
      targetPct: [20, 25, 30, 35, 40],
      atrMultiplier: [1.2, 1.5, 1.8, 2.0],
      ...(STRATEGY === 'trend-pullback' ? { targetR: [1.5, 2.0, 2.5, 3.0] } : {}),
    };

    const results = await runOptimization({ strategyId: STRATEGY, paramGrid });

    console.log(`\nTop 5 parameter sets:`);
    results.slice(0, 5).forEach((r, i) => {
      console.log(`\n  #${i + 1}: Score ${r.score}`);
      console.log(`  Params: ${JSON.stringify(r.params)}`);
      console.log(`  Train: ${r.train.total} trades, PF ${r.train.profitFactor?.toFixed(2)}, Exp ${r.train.expectancy?.toFixed(2)}`);
      console.log(`  Test: ${r.test.total} trades, PF ${r.test.profitFactor?.toFixed(2)}, Exp ${r.test.expectancy?.toFixed(2)}`);
    });

    if (results.length > 0) {
      const pm = new PromotionManager();
      const best = results[0];
      const promo = pm.propose(STRATEGY, best.params, best.test, `Optimized ${STRATEGY} via grid search`);
      console.log(`\nPromotion proposed: ${promo.id}`);
      console.log(`Review at: scripts/backtest/promotions.json`);
    }
  }

  if (MODE === 'promote') {
    const pm = new PromotionManager();
    const pending = pm.getPending();
    if (pending.length === 0) {
      console.log('No pending promotions.');
      return;
    }
    console.log(`\nPending promotions:`);
    pending.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.strategyId} (${p.id}) — PF ${p.testResult.profitFactor}, Exp ${p.testResult.expectancy}`);
      console.log(`     Params: ${JSON.stringify(p.params)}`);
    });
  }
}

main().catch(err => {
  console.error('Backtest failed:', err.message);
  process.exit(1);
});
