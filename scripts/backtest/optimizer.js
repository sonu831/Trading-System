const { BacktestRunner } = require('./backtest-runner');
const { MomentumBurstStrategy } = require('../../layer-6-signal/src/strategies/plugins/momentum-burst');
const { TrendPullbackStrategy } = require('../../layer-6-signal/src/strategies/plugins/trend-pullback');

class GridOptimizer {
  constructor(options = {}) {
    this.timescaleUrl = options.timescaleUrl || process.env.TIMESCALE_URL;
    this.symbol = options.symbol || 'NIFTY';
    this.startDate = options.startDate;
    this.endDate = options.endDate;
    this.walkForwardRatio = options.walkForwardRatio || 0.8;
    this.minTrades = options.minTrades || 20;
  }

  async optimize(strategyId, paramGrid) {
    const strategy = this.createStrategy(strategyId);
    const keys = Object.keys(paramGrid);

    const results = [];
    for (const combo of this.cartesian(keys.map(k => paramGrid[k]))) {
      const params = {};
      keys.forEach((k, i) => { params[k] = combo[i]; });
      const testStrategy = this.createStrategy(strategyId, params);

      const runner = new BacktestRunner({
        timescaleUrl: this.timescaleUrl,
        symbol: this.symbol,
        startDate: this.startDate,
        endDate: this.endDate,
        strategies: [testStrategy],
      });

      const allData = await runner.run();
      if (!allData || allData.length === 0) continue;

      const full = allData[0];
      const trainEnd = this.splitDate(full.trades, this.walkForwardRatio);

      const trainTrades = full.trades.filter(t => new Date(t.entryTime) <= trainEnd);
      const testTrades = full.trades.filter(t => new Date(t.entryTime) > trainEnd);

      const trainMetrics = runner.computeMetrics(trainTrades);
      const testMetrics = runner.computeMetrics(testTrades);

      results.push({
        params,
        train: {
          trades: trainTrades.length,
          ...trainMetrics,
        },
        test: {
          trades: testTrades.length,
          ...testMetrics,
        },
        score: this.computeScore(trainMetrics, testMetrics),
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  async optimizeByRegime(strategyId, paramGrid) {
    const allResults = await this.optimize(strategyId, paramGrid);
    const byRegime = {};

    for (const result of allResults) {
      if (result.test.byRegime) {
        for (const [regime, metrics] of Object.entries(result.test.byRegime)) {
          if (!byRegime[regime]) byRegime[regime] = [];
          byRegime[regime].push({ ...result, regimeMetrics: metrics });
        }
      }
    }

    for (const regime of Object.keys(byRegime)) {
      byRegime[regime].sort((a, b) => {
        const sa = a.test.byRegime?.[regime]?.expectancy || 0;
        const sb = b.test.byRegime?.[regime]?.expectancy || 0;
        return sb - sa;
      });
    }

    return { all: allResults.slice(0, 10), byRegime };
  }

  createStrategy(strategyId, paramsOverride = {}) {
    let strategy;
    if (strategyId === 'momentum-burst') strategy = new MomentumBurstStrategy();
    else if (strategyId === 'trend-pullback') strategy = new TrendPullbackStrategy();
    else throw new Error(`Unknown strategy: ${strategyId}`);

    if (paramsOverride) Object.assign(strategy.params, paramsOverride);
    return strategy;
  }

  computeScore(trainMetrics, testMetrics) {
    if (testMetrics.total < this.minTrades) return -Infinity;
    if (trainMetrics.total < this.minTrades) return -Infinity;

    const profitFactor = Math.min(testMetrics.profitFactor, 5);
    const expectancy = Math.max(Math.min(testMetrics.expectancy, 100), -100);

    let score = 0;
    score += profitFactor * 20;
    score += expectancy * 0.5;
    if (testMetrics.winRate > 0.4) score += 10;
    score -= Math.min(testMetrics.maxDrawdown, 500) * 0.1;

    const trainTestDiff = Math.abs(testMetrics.expectancy - trainMetrics.expectancy);
    if (trainTestDiff > 20) score -= 15;

    return Math.round(score * 100) / 100;
  }

  splitDate(trades, ratio) {
    if (trades.length < 2) return new Date();
    const sorted = trades.sort((a, b) => new Date(a.entryTime) - new Date(b.entryTime));
    const splitIdx = Math.floor(sorted.length * ratio);
    return new Date(sorted[Math.min(splitIdx, sorted.length - 1)].entryTime);
  }

  cartesian(arrays) {
    if (arrays.length === 0) return [[]];
    const [first, ...rest] = arrays;
    const restCartesian = this.cartesian(rest);
    const result = [];
    for (const item of first) {
      for (const combo of restCartesian) {
        result.push([item, ...combo]);
      }
    }
    return result;
  }
}

async function runOptimization(options) {
  const optimizer = new GridOptimizer(options);
  return await optimizer.optimize(options.strategyId, options.paramGrid);
}

module.exports = { GridOptimizer, runOptimization };
