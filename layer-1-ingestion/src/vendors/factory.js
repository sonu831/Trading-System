/**
 * Vendor Factory
 * Instantiates the correct vendor adapter based on configuration
 */
const { KiteVendor } = require('./kite');
const { IndianApiVendor } = require('./indianapi');
const { logger } = require('../../utils/logger');

class VendorFactory {
  static createVendor(options) {
    const provider = process.env.MARKET_DATA_PROVIDER || 'kite';

    logger.info(`🏭 Initializing Market Data Provider: ${provider.toUpperCase()}`);

    switch (provider.toLowerCase()) {
      case 'kite':
      case 'zerodha':
        return new KiteVendor(options);

      case 'indianapi':
        return new IndianApiVendor(options);

      default:
        logger.warn(`⚠️ Unknown provider '${provider}', falling back to Kite`);
        return new KiteVendor(options);
    }
  }
}

module.exports = { VendorFactory };
