const Rules = require('../rules/basic');
const RiskManager = require('../risk/manager');

class DecisionEngine {
  constructor() {
    this.marketSentiment = 'NEUTRAL'; // Default
  }

  updateMarketView(view) {
    if (view && view.breadth) {
      this.marketSentiment = view.breadth.market_sentiment || 'NEUTRAL';
      console.log(
        `🧠 Market Sentiment Updated: ${this.marketSentiment} (A/D: ${view.breadth.advance_decline_ratio?.toFixed(2)})`
      );
    }
  }

  evaluate(stockAnalysis) {
    if (!stockAnalysis || !stockAnalysis.ltp) return null;

    // 1. Market Filter
    // Example: Don't buy if market is Strongly Bearish
    const isMarketBearish = this.marketSentiment.includes('BEARISH');
    const isMarketBullish = this.marketSentiment.includes('BULLISH');

    // 2. Evaluate Strategies
    const trend = Rules.evaluateTrend(stockAnalysis);
    const reversal = Rules.evaluateReversal(stockAnalysis);

    let finalSignal = 'HOLD';
    let confidence = 0;
    let strategy = '';
    let reasons = [];

    // Decision Logic
    // Priority 1: Trend Following (Aligned with Market)
    if (isMarketBullish && trend.score > 0.6) {
      finalSignal = 'BUY';
      confidence = trend.score;
      strategy = 'TREND_FOLLOWING';
      reasons = [...trend.reasons, 'Market Bullish'];
    } else if (isMarketBearish && trend.score < -0.6) {
      finalSignal = 'SELL';
      confidence = Math.abs(trend.score);
      strategy = 'TREND_FOLLOWING';
      reasons = [...trend.reasons, 'Market Bearish'];
    }

    // Priority 2: Reversal (High Probability)
    // Only take revisions if confidence is very high
    else if (reversal.score > 0.7) {
      finalSignal = 'BUY';
      confidence = reversal.score;
      strategy = 'MEAN_REVERSION';
      reasons = [...reversal.reasons];
    } else if (reversal.score < -0.7) {
      finalSignal = 'SELL';
      confidence = Math.abs(reversal.score);
      strategy = 'MEAN_REVERSION';
      reasons = [...reversal.reasons];
    }

    // 3. Risk Management
    if (finalSignal !== 'HOLD') {
      const riskParams = RiskManager.calculateRisk(
        finalSignal,
        stockAnalysis.ltp,
        stockAnalysis.atr
      );

      const riskCheck = RiskManager.isSafeToTrade(stockAnalysis);
      if (!riskCheck.safe) {
        console.log(`⚠️ Signal Blocked for ${stockAnalysis.symbol}: ${riskCheck.reason}`);
        return null;
      }

      return {
        symbol: stockAnalysis.symbol,
        timestamp: new Date().toISOString(),
        action: finalSignal,
        confidence: parseFloat(confidence.toFixed(2)),
        strategy: strategy,
        price: stockAnalysis.ltp,
        stopLoss: riskParams.stopLoss,
        target: riskParams.target,
        riskPerShare: riskParams.riskPerShare,
        reasons: reasons,
        analysis: {
          rsi: stockAnalysis.rsi,
          trend_score: stockAnalysis.trend_score,
          market_sentiment: this.marketSentiment,
        },
      };
    }

    return null;
  }
}

module.exports = new DecisionEngine();
