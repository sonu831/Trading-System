/**
 * Logger utility using Pino
 *
 * Standard #5 from copilot-instructions-layer1.md:
 * Logs should include [VENDOR], [SYMBOL], and [ACTION] tags.
 *
 * Usage:
 *   const { logger, createChildLogger } = require('./logger');
 *
 *   // Basic logging
 *   logger.info('Server started');
 *
 *   // Structured logging with tags
 *   const vendorLog = createChildLogger({ vendor: 'MSTOCK', action: 'CONNECT' });
 *   vendorLog.info('WebSocket connected');
 *   // Output: [MSTOCK] [CONNECT] WebSocket connected
 *
 *   // Per-symbol logging
 *   const symbolLog = createChildLogger({ vendor: 'MSTOCK', symbol: 'RELIANCE', action: 'FETCH' });
 *   symbolLog.info('Fetched 1000 candles');
 *   // Output: [MSTOCK] [RELIANCE] [FETCH] Fetched 1000 candles
 */

const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      messageFormat: '{if vendor}[{vendor}] {end}{if symbol}[{symbol}] {end}{if action}[{action}] {end}{msg}',
    },
  },
});

/**
 * Create a child logger with structured tags
 * @param {Object} tags - { vendor, symbol, action }
 * @returns {pino.Logger} Child logger with tags bound
 */
function createChildLogger(tags = {}) {
  return logger.child(tags);
}

module.exports = { logger, createChildLogger };
