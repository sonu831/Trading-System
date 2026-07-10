/**
 * Standardized Response Builder
 * Ensures consistent return structure across all vendors and methods.
 */
class ResponseBuilder {
  /**
   * Create a Success Response
   * @param {any} data - The payload (e.g., candles, packet)
   * @param {string} message - Optional success message
   * @returns {Object} { status: true, message, data }
   */
  static success(data, message = 'Success') {
    return {
      status: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create an Error Response
   * @param {string} message - Error description
   * @param {string} code - Optional error code (e.g., 'IA401')
   * @param {any} details - Optional extra error details
   * @returns {Object} { status: false, message, errorcode, ... }
   */
  static error(message, code = '', details = null) {
    return {
      status: false,
      message,
      errorcode: code,
      details,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a Historical Data Response
   * @param {Array} candles - Array of candle data
   * @returns {Object} Standardized historical data response
   */
  static historical(candles) {
    return this.success({ candles }, `Retrieved ${candles.length} candles`);
  }
}

module.exports = { ResponseBuilder };
