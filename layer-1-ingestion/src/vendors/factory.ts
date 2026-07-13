/**
 * VendorFactory — thin wrapper over VendorRegistry.
 * Adding a vendor = add an entry to vendor-registry.ts. No other file changes needed.
 *
 * @deprecated Use VendorRegistry directly: `import { resolveVendor } from './vendor-registry'`
 *   This file is kept for backward compatibility.
 */
import { resolveVendor as registryResolve, VENDOR_REGISTRY } from './vendor-registry';
import { OptionChainPoller } from './option-chain-poller';
import type { BaseVendor } from './base';

const logger = require('../utils/logger');

type ProviderName = string;

class VendorFactory {
  static createVendor(options: Record<string, any>, explicitProvider: string | null = null): BaseVendor | OptionChainPoller {
    const provider = (explicitProvider || process.env.MARKET_DATA_PROVIDER || 'mstock').toLowerCase();

    if (provider === 'optionchain') {
      return new OptionChainPoller(options);
    }

    const entry = VENDOR_REGISTRY[provider] || VENDOR_REGISTRY['mstock'];
    logger.info(`Initializing Market Data Provider: ${entry?.label || provider.toUpperCase()}`);

    return entry.factory(options);
  }
}

module.exports = { VendorFactory };
export type { ProviderName };
