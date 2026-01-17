/**
 * Base Vendor Integration Interface
 * All vendor implementations must extend this class
 */
class BaseVendor {
  constructor(options) {
    this.name = 'BaseVendor';
    this.options = options;
    this.onTick = options.onTick;
  }

  /**
   * Connect to the vendor's data stream
   * @returns {Promise<void>}
   */
  async connect() {
    throw new Error('Method connect() must be implemented');
  }

  /**
   * Disconnect from the vendor
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('Method disconnect() must be implemented');
  }

  /**
   * Subscribe to list of symbols
   * @param {Array<string>} symbols
   */
  subscribe(symbols) {
    throw new Error('Method subscribe() must be implemented');
  }

  /**
   * Check connection status
   * @returns {boolean}
   */
  isConnected() {
    return false;
  }
}

module.exports = { BaseVendor };
