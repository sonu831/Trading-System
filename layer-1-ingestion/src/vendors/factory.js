/** VendorFactory — creates the correct vendor adapter. */
const { KiteVendor } = require('./kite');
const { IndianApiVendor } = require('./indianapi');
const { MStockVendor } = require('./mstock');
const { FlatTradeVendor } = require('./flattrade');
const { CompositeVendor } = require('./composite');
const { OptionChainPoller } = require('./option-chain-poller');
const logger = require('../utils/logger').logger;

type ProviderName = 'kite' | 'zerodha' | 'indianapi' | 'mstock' | 'flattrade' | 'composite' | 'optionchain';

class VendorFactory {
  static createVendor(options: Record<string, any>, explicitProvider: string | null = null): any {
    const provider = (explicitProvider || process.env.MARKET_DATA_PROVIDER || 'kite').toLowerCase();
    if (provider === 'optionchain') return new OptionChainPoller(options);
    logger.info(`Initializing: ${provider.toUpperCase()}`);
    switch (provider) {
      case 'kite': case 'zerodha': return new KiteVendor(options);
      case 'indianapi': return new IndianApiVendor(options);
      case 'mstock': return new MStockVendor(options);
      case 'flattrade': return new FlatTradeVendor(options);
      case 'composite': return new CompositeVendor(options);
      default: logger.warn(`Unknown provider '${provider}', fallback to Kite`); return new KiteVendor(options);
    }
  }
}

export = { VendorFactory };
