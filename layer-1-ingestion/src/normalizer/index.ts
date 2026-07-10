/**
 * Normalizer - Converts raw broker ticks to unified schema
 *
 * Uses SymbolRegistry (shared master map) for token resolution
 * instead of the legacy config/symbols.json (which only had Kite tokens).
 */

const { SymbolRegistry } = require('../utils/symbol-registry');
const logger = require('../utils/logger');

const INDEX_SYMBOLS = new Set(['NIFTY', 'BANKNIFTY', 'INDIAVIX']);

class Normalizer {
  constructor() {
    SymbolRegistry.load();
  }

  /**
   * Normalize raw tick to unified schema
   * @param {Object} rawTick - Raw tick from broker
   * @returns {Object|null} Normalized tick or null if invalid
   */
  normalize(rawTick) {
    try {
      let symbol, exchange;

      if (rawTick.symbol) {
        // Mapper already resolved the symbol (preferred path)
        symbol = rawTick.symbol;
        exchange = rawTick.exchange || 'NSE';
      } else if (rawTick.token) {
        // Resolve via SymbolRegistry (fallback path)
        const resolved = SymbolRegistry.getSymbol('mstock', rawTick.token)
          || SymbolRegistry.getSymbol('kite', rawTick.token)
          || SymbolRegistry.getSymbol('flattrade', rawTick.token);
        if (!resolved) {
          logger.warn(`Normalizer: Unknown token: ${rawTick.token}`);
          return null;
        }
        symbol = resolved;
        const info = SymbolRegistry.getInfo(symbol);
        exchange = info ? info.exchange : 'NSE';
      } else {
        logger.warn('Normalizer: Tick has no symbol or token');
        return null;
      }

      // Validate price
      if (rawTick.ltp === undefined || rawTick.ltp === null || rawTick.ltp <= 0) {
        if (!INDEX_SYMBOLS.has(symbol) || rawTick.ltp === undefined) {
          return null;
        }
      }

      // Treat INDIAVIX ltp as-is (it's a value like 14.5, not a price)
      const ltp = symbol === 'INDIAVIX'
        ? parseFloat(rawTick.ltp)
        : parseFloat(parseFloat(rawTick.ltp).toFixed(2));

      const timestamp = rawTick.timestamp
        ? (rawTick.timestamp instanceof Date ? rawTick.timestamp.getTime() : Number(rawTick.timestamp))
        : Date.now();

      const normalizedTick = {
        symbol,
        exchange,
        timestamp,
        ltp,
        ltq: rawTick.ltq || 0,
        volume: rawTick.volume || 0,
        bid: rawTick.bid || rawTick.ltp || 0,
        ask: rawTick.ask || rawTick.ltp || 0,
        open: rawTick.open || 0,
        high: rawTick.high || 0,
        low: rawTick.low || 0,
        close: rawTick.close || 0,
        buyQuantity: rawTick.buyQuantity || 0,
        sellQuantity: rawTick.sellQuantity || 0,
        instrumentType: INDEX_SYMBOLS.has(symbol) ? 'index' : 'stock',
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
    if (!tick.symbol || tick.timestamp === undefined || tick.timestamp === null) {
      return false;
    }

    // INDIAVIX has values like 10-30, not prices
    if (tick.symbol === 'INDIAVIX') {
      return tick.ltp > 0;
    }

    if (!tick.ltp || tick.ltp <= 0) {
      return false;
    }

    // Check for future timestamps (allow 1 second tolerance)
    if (tick.timestamp > Date.now() + 1000) {
      logger.warn(`Future timestamp detected for ${tick.symbol}`);
      return false;
    }

    // Check for reasonable price range (indices can go above 1M but cap at 5M)
    if (tick.ltp < 0 || tick.ltp > 5000000) {
      logger.warn(`Invalid price for ${tick.symbol}: ${tick.ltp}`);
      return false;
    }

    return true;
  }
}

module.exports = { Normalizer };
