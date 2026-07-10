/**
 * Vendor Factory
 * Instantiates the correct vendor adapter based on configuration
 */
const { KiteVendor } = require('./kite');
const { IndianApiVendor } = require('./indianapi');
const { MStockVendor } = require('./mstock');
const { FlatTradeVendor } = require('./flattrade');
const { CompositeVendor } = require('./composite');
const { OptionChainPoller } = require('./option-chain-poller');
const { logger } = require('../utils/logger');

class VendorFactory {
  static createVendor(options, explicitProvider = null) {
    const provider = explicitProvider || process.env.MARKET_DATA_PROVIDER || 'kite';

    if (provider.toLowerCase() === 'optionchain') {
      return new OptionChainPoller(options);
    }

    logger.info(`Initializing Market Data Provider: ${provider.toUpperCase()}`);

    switch (provider.toLowerCase()) {
      case 'kite':
      case 'zerodha':
        return new KiteVendor(options);

      case 'indianapi':
        return new IndianApiVendor(options);

      case 'mstock':
        return new MStockVendor(options);

      case 'flattrade':
        return new FlatTradeVendor(options);

      case 'composite':
        return new CompositeVendor(options);

      default:
        logger.warn(`Unknown provider '${provider}', falling back to Kite`);
        return new KiteVendor(options);
    }
  }
}

module.exports = { VendorFactory };
