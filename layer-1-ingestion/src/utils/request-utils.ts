/**
 * Request Utilities
 * Normalizes input parameters for consistency across vendors.
 */
class RequestUtils {
  /**
   * Normalize Historical Data Parameters
   * Ensures keys are consistent (vendor APIs are picky about casing).
   * MStock prefers lowercase 'fromdate', 'todate', 'interval'.
   *
   * @param {Object} params
   * @returns {Object} Normalized params object
   */
  static normalizeHistoricalParams(params) {
    const p = { ...params };

    // Map common date keys to vendor preference (MStock: lowercase)
    if (p.fromDate) p.fromdate = p.fromDate;
    if (p.toDate) p.todate = p.toDate;

    // Ensure Interval is present
    if (!p.interval) p.interval = 'ONE_MINUTE'; // Default

    // Clean up duplicates if desired, or keep both for compatibility
    // For MStock via SDK, 'fromdate' is the key.

    return p;
  }

  /**
   * Validate required fields for Historical Data
   * @param {Object} params
   * @returns {boolean} isValid
   */
  static validateHistoricalParams(params) {
    if (!params.exchange) throw new Error("Missing 'exchange' parameter");
    if (!params.symboltoken) throw new Error("Missing 'symboltoken' parameter");
    if (!params.fromdate) throw new Error("Missing 'fromdate' parameter");
    if (!params.todate) throw new Error("Missing 'todate' parameter");
    return true;
  }
}

module.exports = { RequestUtils };
