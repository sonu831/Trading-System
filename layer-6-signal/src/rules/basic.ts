/**
 * Basic Trading Rules
 * Evaluates technical indicators to generate scores
 */
class BasicRules {
  /**
   * Evaluate Trend Following Strategy
   * @param {Object} analysis
   * @returns {Object} { score, signal, reason }
   */
  evaluateTrend(analysis) {
    let score = 0;
    const reasons = [];

    // 1. Supertrend (Strongest Indicator)
    if (analysis.supertrend && analysis.supertrend.direction > 0) {
      score += 0.4;
      reasons.push('Supertrend Bullish');
    } else if (analysis.supertrend && analysis.supertrend.direction < 0) {
      score -= 0.4;
      reasons.push('Supertrend Bearish');
    }

    // 2. EMA Alignment (Trend)
    // Assuming L4 provides trend_score which is already based on EMAs
    if (analysis.trend_score > 0) {
      score += 0.3;
      reasons.push('EMA Bullish Alignment');
    } else if (analysis.trend_score < 0) {
      score -= 0.3;
      reasons.push('EMA Bearish Alignment');
    }

    // 3. RSI Momentum
    if (analysis.rsi > 55 && analysis.rsi < 70) {
      score += 0.2; // Strong Momentum
    } else if (analysis.rsi < 45 && analysis.rsi > 30) {
      score -= 0.2; // Weak Momentum
    }

    return { score, reasons };
  }

  /**
   * Evaluate Reversal Strategy (Oversold/Overbought)
   * @param {Object} analysis
   */
  evaluateReversal(analysis) {
    let score = 0;
    const reasons = [];

    if (analysis.rsi < 30) {
      score += 0.6;
      reasons.push('RSI Oversold (<30)');
    } else if (analysis.rsi > 70) {
      score -= 0.6;
      reasons.push('RSI Overbought (>70)');
    }

    if (analysis.bollinger) {
      if (analysis.ltp < analysis.bollinger.lower) {
        score += 0.3;
        reasons.push('Price below Lower Bollinger Band');
      } else if (analysis.ltp > analysis.bollinger.upper) {
        score -= 0.3;
        reasons.push('Price above Upper Bollinger Band');
      }
    }

    return { score, reasons };
  }
}

module.exports = new BasicRules();
