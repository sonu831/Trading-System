/**
 * Base Mapper Interface
 * standardizes all vendor ticks into the InternalTick schema
 */
const { SymbolRegistry } = require('../utils/symbol-registry');

class BaseMapper {
  constructor(vendorName) {
    this.vendorName = vendorName;
    // Ensure Registry is loaded (idempotent)
    SymbolRegistry.load();
  }

  /**
   * Map raw vendor data to InternalTick
   * @param {Object} data - Raw vendor string/object
   * @returns {Object|null} InternalTick or null
   */
  map(data) {
    throw new Error('map() must be implemented');
  }

  /**
   * Resolve System Symbol from Vendor Token
   */
  getSymbol(token) {
    return SymbolRegistry.getSymbol(this.vendorName, token);
  }

  /**
   * Helper: Parse float safely
   */
  parseNumber(val) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  }
}

module.exports = { BaseMapper };
