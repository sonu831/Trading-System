/**
 * Vendor Manager ("The Octopus")
 * Orchestrates multiple market data vendors concurrently.
 * Reads provider list from CredentialStore (API/DB-driven, no env vars).
 */
const { VendorFactory } = require('./factory');
const { logger } = require('../utils/logger');

class VendorManager {
  constructor(options) {
    this.options = options;
    this.vendors = new Map();
    this.onTick = options.onTick;
    this.credentialStore = options.credentialStore || null;
    this._tokenRefreshInterval = null;
  }

  /**
   * Initialize all enabled vendors from CredentialStore (with env fallback)
   */
  async init() {
    let providerNames;

    if (this.credentialStore) {
      await this.credentialStore.init();
      providerNames = this.credentialStore.getEnabledProviderNames();

      this.credentialStore.onProvidersChange((providers) => {
        logger.info('VendorManager: Provider list changed, rebuilding...');
        this.rebuild(providers.map((p) => p.provider));
      });
    } else {
      const enabledStr = process.env.ENABLED_VENDORS || process.env.MARKET_DATA_PROVIDER || 'kite';
      providerNames = [...new Set(enabledStr.split(',').map((s) => s.trim().toLowerCase()))];
    }

    if (providerNames.length === 0) {
      logger.warn('VendorManager: No providers enabled. Ingestion will be idle.');
      return;
    }

    logger.info(`VendorManager: Initializing [${providerNames.join(', ')}]...`);
    this.initVendors(providerNames);

    if (this.credentialStore) {
      this._tokenRefreshInterval = setInterval(() => this.refreshTokens(), 30000);
    }
  }

  async refreshTokens() {
    try {
      await this.credentialStore.loadTokens();
      for (const [name, vendor] of this.vendors) {
        const token = this.credentialStore.getToken(name);
        if (token && vendor.setAccessToken) {
          vendor.setAccessToken(token);
        }
      }
    } catch (err) {
      // Silently skip — token refresh is best-effort; L7 is the authority.
    }
  }

  initVendors(providerNames) {
    providerNames.forEach((name) => {
      try {
        const token = this.credentialStore ? this.credentialStore.getToken(name) : null;

        const vendor = VendorFactory.createVendor(
          {
            ...this.options,
            onTick: (tick) => this.handleAggregatedTick(tick),
            sessionToken: token,
            credentialStore: this.credentialStore,
          },
          name
        );

        if (vendor) {
          this.vendors.set(name, vendor);
        }
      } catch (e) {
        logger.error(`VendorManager: Failed to init vendor '${name}': ${e.message}`);
      }
    });
  }

  /**
   * Hot-reload: disconnect removed providers, connect new ones
   */
  async rebuild(providerNames) {
    const currentNames = new Set(this.vendors.keys());
    const newNames = new Set(providerNames);

    for (const name of currentNames) {
      if (!newNames.has(name)) {
        const v = this.vendors.get(name);
        try { await v.disconnect(); } catch (_) {}
        this.vendors.delete(name);
        logger.info(`VendorManager: Removed ${name} (disabled)`);
      }
    }

    for (const name of newNames) {
      if (!currentNames.has(name)) {
        try {
          const token = this.credentialStore ? this.credentialStore.getToken(name) : null;
          const vendor = VendorFactory.createVendor(
            { ...this.options, onTick: (t) => this.handleAggregatedTick(t), sessionToken: token },
            name
          );
          this.vendors.set(name, vendor);
          logger.info(`VendorManager: Added ${name} (newly enabled)`);
        } catch (e) {
          logger.error(`VendorManager: Failed to add '${name}': ${e.message}`);
        }
      }
    }
  }

  async connect() {
    const promises = [];
    for (const [name, vendor] of this.vendors) {
      logger.info(`VendorManager: Connecting ${name}...`);
      promises.push(
        vendor.connect().catch((e) => {
          logger.error(`VendorManager: ${name} connection failed: ${e.message}`);
        })
      );
    }
    await Promise.all(promises);
    logger.info('VendorManager: All connection attempts finished.');
  }

  async disconnect() {
    if (this._tokenRefreshInterval) {
      clearInterval(this._tokenRefreshInterval);
      this._tokenRefreshInterval = null;
    }
    for (const [name, vendor] of this.vendors) {
      try { await vendor.disconnect(); } catch (e) { logger.error(e); }
    }
  }

  handleAggregatedTick(tick) {
    if (!tick || !this.onTick) return;
    this.onTick(tick);
  }

  getVendor(name) {
    return this.vendors.get(name.toLowerCase());
  }

  subscribe(symbols) {
    this.vendors.forEach((vendor, name) => {
      try { vendor.subscribe(symbols); } catch (e) {
        logger.warn(`VendorManager: Failed to subscribe ${name}: ${e.message}`);
      }
    });
  }

  isConnected() {
    for (const v of this.vendors.values()) {
      if (v.isConnected()) return true;
    }
    return false;
  }
}

module.exports = { VendorManager };
