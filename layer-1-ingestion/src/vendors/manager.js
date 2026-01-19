/**
 * Vendor Manager ("The Octopus")
 * Orchestrates multiple market data vendors concurrently.
 */
const { VendorFactory } = require('./factory');
const { logger } = require('../utils/logger');

class VendorManager {
  constructor(options) {
    this.options = options;
    this.vendors = new Map(); // Name -> VendorInstance
    this.onTick = options.onTick; // aggregated callback
  }

  /**
   * Initialize all enabled vendors
   */
  init() {
    // 1. Determine Enabled Vendors
    // Format: "kite,mstock" or fallback to single MARKET_DATA_PROVIDER
    const enabledStr = process.env.ENABLED_VENDORS || process.env.MARKET_DATA_PROVIDER || 'kite';
    const providerNames = enabledStr.split(',').map((s) => s.trim().toLowerCase());

    // Deduplicate
    const uniqueProviders = [...new Set(providerNames)];

    logger.info(`🐙 VendorManager: Initializing [${uniqueProviders.join(', ')}]...`);

    uniqueProviders.forEach((name) => {
      try {
        const vendor = VendorFactory.createVendor(
          {
            ...this.options,
            onTick: (tick) => this.handleAggregatedTick(tick),
          },
          name
        );

        if (vendor) {
          this.vendors.set(name, vendor);
        }
      } catch (e) {
        logger.error(`❌ Failed to init vendor '${name}': ${e.message}`);
      }
    });
  }

  /**
   * Connect all vendors in parallel
   */
  async connect() {
    const promises = [];
    for (const [name, vendor] of this.vendors) {
      logger.info(`🔌 Connecting ${name}...`);
      promises.push(
        vendor.connect().catch((e) => {
          logger.error(`❌ ${name} Connection Failed: ${e.message}`);
          // Don't fail entire batch, let others proceed
        })
      );
    }
    await Promise.all(promises);
    logger.info(`✅ VendorManager: All connection attempts finished.`);
  }

  /**
   * Disconnect all vendors
   */
  async disconnect() {
    const promises = [];
    for (const [name, vendor] of this.vendors) {
      promises.push(vendor.disconnect().catch((e) => logger.error(e)));
    }
    await Promise.all(promises);
  }

  /**
   * Centralized Tick Handler
   * Fan-in from all vendors
   */
  handleAggregatedTick(tick) {
    if (!tick) return;

    // Future: De-duplication or Source-Labeling logic here
    // For now, pass through everything
    if (this.onTick) {
      this.onTick(tick);
    }
  }

  /**
   * Get specific vendor instance
   * @param {string} name
   */
  getVendor(name) {
    return this.vendors.get(name.toLowerCase());
  }

  /**
   * Subscribe symbols to ALL active vendors
   * @param {Array} symbols
   */
  subscribe(symbols) {
    this.vendors.forEach((vendor, name) => {
      try {
        vendor.subscribe(symbols);
      } catch (e) {
        logger.warn(`Failed to subscribe ${name}: ${e.message}`);
      }
    });
  }

  isConnected() {
    // Logic: Are ANY vendors connected?
    for (const v of this.vendors.values()) {
      if (v.isConnected()) return true;
    }
    return false;
  }
}

module.exports = { VendorManager };
