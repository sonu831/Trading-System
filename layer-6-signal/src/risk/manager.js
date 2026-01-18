/**
 * Risk Management Logic
 * Calculates Stop Loss, Targets, and Position Sizing
 */
class RiskManager {
  constructor() {
    this.DEFAULT_RISK_PER_TRADE = 0.01; // 1% risk per trade
    this.DEFAULT_ACCOUNT_BALANCE = 100000; // Mock balance
  }

  /**
   * Calculate Stop Loss and Target
   * @param {string} action 'BUY' or 'SELL'
   * @param {number} ltp Last Traded Price
   * @param {number} atr Average True Range
   * @param {Object} options Configuration options
   */
  calculateRisk(action, ltp, atr, options = {}) {
    if (!ltp || !atr) return null;

    const multiplier = options.multiplier || 2.0; // Stop = 2 * ATR
    const rrRatio = options.rrRatio || 1.5; // Reward:Risk = 1.5:1

    let stopLoss, target;
    const slDist = atr * multiplier;

    if (action === 'BUY') {
      stopLoss = ltp - slDist;
      target = ltp + slDist * rrRatio;
    } else {
      stopLoss = ltp + slDist;
      target = ltp - slDist * rrRatio;
    }

    // Round to 2 decimals
    return {
      stopLoss: Math.round(stopLoss * 100) / 100,
      target: Math.round(target * 100) / 100,
      riskPerShare: Math.round(slDist * 100) / 100,
    };
  }

  /**
   * Validate if a trade is safe
   * @param {Object} analysis Stock analysis data
   */
  isSafeToTrade(analysis) {
    // 1. Check for extreme volatility (ATR > 5% of price)
    if (analysis.atr && analysis.ltp) {
      if (analysis.atr / analysis.ltp > 0.05) {
        return { safe: false, reason: 'Extreme Volatility' };
      }
    }

    // 2. Check Spread/Liquidity (Mock check)
    // if (spread > X) return false;

    return { safe: true };
  }
}

module.exports = new RiskManager();
