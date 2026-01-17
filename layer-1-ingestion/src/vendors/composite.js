/**
 * Composite Vendor Adapter
 * Aggregates multiple vendors to provide redundancy and data aggregation.
 * Strategy: "Race" (First tick wins) or "Failover" (Active-Passive).
 * Currently implements: Aggregation (Listen to all, deduplicate later if needed)
 */

const { BaseVendor } = require('./base');
const { KiteVendor } = require('./kite');
const { IndianApiVendor } = require('./indianapi');
const { MStockVendor } = require('./mstock');
const { FlatTradeVendor } = require('./flattrade');
const { logger } = require('../utils/logger');

class CompositeVendor extends BaseVendor {
  constructor(options) {
    super(options);
    this.options = options;
    this.vendors = [];

    // Initialize child vendors
    // In a real scenario, this list might be dynamic or env-driven
    // For now, we hardcode the aggregation of known vendors
    this.createChildVendors();
  }

  createChildVendors() {
    // 1. Kite
    if (process.env.ZERODHA_API_KEY) {
      this.vendors.push(new KiteVendor(this.options));
    }

    // 2. IndianApi (Simulated/External)
    // Always add, or check a flag
    this.vendors.push(new IndianApiVendor(this.options));

    // 3. MStock (Type B)
    if (process.env.MSTOCK_ACCESS_TOKEN || process.env.MARKET_DATA_PROVIDER === 'mstock') {
      this.vendors.push(new MStockVendor(this.options));
    }

    // 4. FlatTrade
    if (process.env.FLATTRADE_USER_ID || process.env.MARKET_DATA_PROVIDER === 'flattrade') {
      this.vendors.push(new FlatTradeVendor(this.options));
    }

    logger.info(`🔗 CompositeVendor initialized with ${this.vendors.length} child vendors`);
  }

  /**
   * Connect to all child vendors
   */
  async connect() {
    logger.info('🚀 CompositeVendor: Connecting to all providers...');

    const promises = this.vendors.map((vendor) => {
      return vendor.connect().catch((err) => {
        logger.error(`❌ Child vendor connection failed: ${err.message}`);
        // We don't throw here so other vendors can still connect
        return null;
      });
    });

    await Promise.all(promises);

    // Check if at least one connected
    if (this.vendors.some((v) => v.isConnected())) {
      this.connected = true;
      logger.info('✅ CompositeVendor: At least one provider connected successfully.');
    } else {
      throw new Error('All child vendors failed to connect.');
    }
  }

  /**
   * Disconnect all child vendors
   */
  async disconnect() {
    logger.info('🔌 CompositeVendor: Disconnecting all providers...');
    await Promise.all(this.vendors.map((v) => v.disconnect()));
    this.connected = false;
  }

  /**
   * Subscribe logic for all children
   * @param {Array<string>} symbols
   */
  subscribe(symbols) {
    this.vendors.forEach((vendor) => {
      if (vendor.isConnected()) {
        try {
          vendor.subscribe(symbols);
        } catch (err) {
          logger.error(`⚠️ Child vendor subscribe failed: ${err.message}`);
        }
      }
    });
  }

  /**
   * Override onTick setter to propagate to children
   */
  set onTick(callback) {
    super.onTick = callback;

    // Propagate usage:
    // When a child receives a tick, it calls this composite's onTick wrapper
    this.vendors.forEach((vendor) => {
      vendor.onTick = (tick) => {
        // Here we can add "Dedup" logic or "Source Tagging"
        // For now, we just pass-through (Race condition is acceptable for raw speed)
        // Optionally add provider tag: tick.provider = vendor.constructor.name;
        if (this._onTick) {
          this._onTick(tick);
        }
      };
    });
  }

  get onTick() {
    return this._onTick;
  }

  isConnected() {
    return this.vendors.some((v) => v.isConnected());
  }
}

module.exports = { CompositeVendor };
