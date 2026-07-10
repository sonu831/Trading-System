/**
 * VendorFactory — typed factory for data source adapters.
 * Adding a vendor = add a case below. No other file changes needed.
 */
import { KiteVendor } from './kite';
import { IndianApiVendor } from './indianapi';
import { MStockVendor } from './mstock';
import { FlatTradeVendor } from './flattrade';
import { CompositeVendor } from './composite';
import { OptionChainPoller } from './option-chain-poller';
import type { BaseVendor } from './base';

const logger = require('../utils/logger');

type ProviderName = 'kite' | 'zerodha' | 'indianapi' | 'mstock' | 'flattrade' | 'composite' | 'optionchain';

class VendorFactory {
  static createVendor(options: Record<string, any>, explicitProvider: string | null = null): BaseVendor | OptionChainPoller {
    const provider = (explicitProvider || process.env.MARKET_DATA_PROVIDER || 'kite').toLowerCase();

    if (provider === 'optionchain') {
      return new OptionChainPoller(options);
    }

    logger.info(`Initializing Market Data Provider: ${provider.toUpperCase()}`);

    switch (provider) {
      case 'kite': case 'zerodha': return new KiteVendor(options);
      case 'indianapi': return new IndianApiVendor(options);
      case 'mstock': return new MStockVendor(options);
      case 'flattrade': return new FlatTradeVendor(options);
      case 'composite': return new CompositeVendor(options);
      default:
        logger.warn(`Unknown provider '${provider}', falling back to Kite`);
        return new KiteVendor(options);
    }
  }
}

export = { VendorFactory };
export type { ProviderName };
