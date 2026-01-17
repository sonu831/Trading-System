/**
 * Base Mapper Interface
 * Defines how vendor-specific data is converted to internal Tick schema
 */
class BaseMapper {
  /**
   * @param {Object} options - Configuration options (e.g. symbol mappings)
   */
  constructor(options = {}) {
    this.options = options;
  }

  /**
   * Maps a vendor specific tick/quote to internal schema
   * @param {Object} data - Raw data from vendor
   * @returns {Object|null} Normalized Tick object
   */
  map(data) {
    throw new Error('Method map() must be implemented');
  }

  /**
   * Common utility to safely parse numbers
   * @param {any} val
   * @returns {number}
   */
  parseNumber(val) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
  }
}

module.exports = { BaseMapper };
