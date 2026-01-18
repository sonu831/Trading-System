/**
 * Normalizer - Converts raw broker ticks to unified schema
 */

const symbolConfig = require('../../config/symbols.json');
const { logger } = require('../utils/logger');

class Normalizer {
  constructor() {
    // Create token to symbol mapping
    this.tokenSymbolMap = {};
    symbolConfig.nifty50.forEach((item) => {
      this.tokenSymbolMap[item.token] = {
        symbol: item.symbol,
        exchange: item.exchange,
      };
    });
  }

  /**
   * Normalize raw tick to unified schema
   * @param {Object} rawTick - Raw tick from broker
   * @returns {Object|null} Normalized tick or null if invalid
   */
  normalize(rawTick) {
    try {
      // Get symbol info from token
      const symbolInfo = this.tokenSymbolMap[rawTick.token];

      if (!symbolInfo) {
        logger.warn(`Unknown token: ${rawTick.token}`);
        return null;
      }

      // Validate price
      if (!rawTick.ltp || rawTick.ltp <= 0) {
        return null;
      }

      // Create unified tick schema
      const normalizedTick = {
        symbol: symbolInfo.symbol,
        exchange: symbolInfo.exchange,
        timestamp: rawTick.timestamp ? rawTick.timestamp.getTime() : Date.now(),
        ltp: parseFloat(rawTick.ltp.toFixed(2)),
        ltq: rawTick.ltq || 0,
        volume: rawTick.volume || 0,
        bid: rawTick.bid || rawTick.ltp,
        ask: rawTick.ask || rawTick.ltp,
        open: rawTick.open || 0,
        high: rawTick.high || 0,
        low: rawTick.low || 0,
        close: rawTick.close || 0,
        buyQuantity: rawTick.buyQuantity || 0,
        sellQuantity: rawTick.sellQuantity || 0,
      };

      return this.validate(normalizedTick) ? normalizedTick : null;
    } catch (error) {
      logger.error('Normalization error:', error);
      return null;
    }
  }

  /**
   * Validate normalized tick
   */
  validate(tick) {
    // Check required fields
    if (!tick.symbol || !tick.ltp || !tick.timestamp) {
      return false;
    }

    // Check for future timestamps (allow 1 second tolerance)
    if (tick.timestamp > Date.now() + 1000) {
      logger.warn(`Future timestamp detected for ${tick.symbol}`);
      return false;
    }

    // Check for reasonable price range
    if (tick.ltp < 0 || tick.ltp > 1000000) {
      logger.warn(`Invalid price for ${tick.symbol}: ${tick.ltp}`);
      return false;
    }

    return true;
  }
}

module.exports = { Normalizer };
