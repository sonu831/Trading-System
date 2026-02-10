/**
 * Retry Utility - Exponential Backoff & Circuit Breaker
 *
 * Standard #3 from copilot-instructions-layer1.md:
 * - Exponential backoff for failed API calls (429, 500, 503)
 * - Circuit breaker to stop requests after continuous failures
 *
 * @module utils/retry
 */

const { logger } = require('./logger');

/**
 * Fetch with exponential backoff retry
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.attempts - Max attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in ms (default: 1000)
 * @param {string} options.label - Label for logging (e.g., "[MSTOCK] [RELIANCE] [FETCH]")
 * @returns {Promise<*>} Result of fn()
 */
async function fetchWithRetry(fn, options = {}) {
  const { attempts = 3, baseDelay = 1000, label = '[RETRY]' } = options;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const isRetryable = [429, 500, 502, 503].includes(err.response?.status) || err.code === 'ECONNRESET';

      if (i === attempts - 1 || !isRetryable) {
        logger.error(`${label} Failed after ${i + 1} attempts: ${err.message}`);
        throw err;
      }

      const waitTime = Math.pow(2, i) * baseDelay; // 1s, 2s, 4s...
      logger.warn(`${label} Attempt ${i + 1}/${attempts} failed (${err.response?.status || err.code}). Retrying in ${waitTime}ms...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }
}

/**
 * Circuit Breaker - Stops requests after continuous failures
 *
 * Standard #3: If a vendor fails continuously (e.g., 10 failures in 1 minute),
 * trip the circuit breaker and stop requests for 5 minutes.
 */
class CircuitBreaker {
  /**
   * @param {Object} options
   * @param {number} options.failureThreshold - Number of failures before tripping (default: 10)
   * @param {number} options.resetTimeout - Time in ms before resetting (default: 300000 = 5 min)
   * @param {string} options.name - Name for logging
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 10;
    this.resetTimeout = options.resetTimeout || 5 * 60 * 1000; // 5 minutes
    this.name = options.name || 'default';

    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED = ok, OPEN = tripped, HALF_OPEN = testing
  }

  /**
   * Check if circuit breaker allows request
   * @returns {boolean}
   */
  isOpen() {
    if (this.state === 'OPEN') {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info(`[CIRCUIT_BREAKER] [${this.name}] Half-open: allowing test request`);
        return false; // Allow one test request
      }
      return true; // Still tripped
    }
    return false;
  }

  /**
   * Record a successful call
   */
  onSuccess() {
    if (this.state === 'HALF_OPEN') {
      logger.info(`[CIRCUIT_BREAKER] [${this.name}] Reset after successful test`);
    }
    this.failures = 0;
    this.state = 'CLOSED';
  }

  /**
   * Record a failed call
   */
  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error(
        `[CIRCUIT_BREAKER] [${this.name}] TRIPPED after ${this.failures} failures. ` +
        `Blocking requests for ${this.resetTimeout / 1000}s.`
      );
    }
  }

  /**
   * Execute a function with circuit breaker protection
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>}
   */
  async execute(fn) {
    if (this.isOpen()) {
      throw new Error(`[CIRCUIT_BREAKER] [${this.name}] Circuit is OPEN. Request blocked.`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }
}

module.exports = { fetchWithRetry, CircuitBreaker };
