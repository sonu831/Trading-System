/**
 * VendorManager — orchestrates multiple market data vendors.
 * Reads providers from CredentialStore (API/DB-driven, env var fallback).
 */
import { VendorFactory } from './factory';
import type { ProviderName } from './factory';

const logger = require('../utils/logger');

interface Vendor { connect(): Promise<void>; disconnect(): Promise<void>; subscribe(symbols: string[]): void; isConnected(): boolean; }

class VendorManager {
  options: Record<string, any>;
  vendors: Map<string, Vendor>;
  onTick: ((tick: any) => void) | null;
  credentialStore: any;

  constructor(options: Record<string, any>) {
    this.options = options; this.vendors = new Map();
    this.onTick = options.onTick || null;
    this.credentialStore = options.credentialStore || null;
  }

  async init(): Promise<void> {
    let providerNames: string[];
    if (this.credentialStore) {
      await this.credentialStore.init();
      providerNames = this.credentialStore.getEnabledProviderNames();
      this.credentialStore.onProvidersChange((providers: any[]) => {
        logger.info('VendorManager: provider list changed, rebuilding...');
        this.rebuild(providers.map((p: any) => p.provider));
      });
    } else {
      const envStr = process.env.ENABLED_VENDORS || process.env.MARKET_DATA_PROVIDER || 'kite';
      providerNames = [...new Set(envStr.split(',').map((s: string) => s.trim().toLowerCase()))];
    }
    if (!providerNames.length) { logger.warn('VendorManager: no providers'); return; }
    logger.info(`VendorManager: [${providerNames.join(', ')}]`);
    this.initVendors(providerNames);
  }

  /**
   * Build a vendor from whatever the control plane currently knows about it.
   *
   * Credentials live in the database now, so the vendor's api_key must be handed to it here.
   * It used to fall back to `process.env.MSTOCK_API_KEY` — an env var that was deliberately
   * removed in the credentials-to-DB migration. The vendor was therefore constructed with an
   * empty apiKey, built no REST client, and logged "missing apiKey — cannot connect" no matter
   * how fresh its session token was.
   */
  private buildVendor(name: string) {
    const creds = this.credentialStore?.getCredentials(name) || {};
    return VendorFactory.createVendor(
      {
        ...this.options,
        onTick: (t: any) => this.handleTick(t),
        sessionToken: this.credentialStore?.getToken(name),
        apiKey: creds.api_key,
        credentials: creds, // each adapter takes the fields its broker actually needs
      },
      name,
    );
  }

  initVendors(providerNames: string[]): void {
    providerNames.forEach(name => {
      try {
        const vendor = this.buildVendor(name);
        if (vendor) this.vendors.set(name, vendor as any);
      } catch (e: any) { logger.error(`VendorManager: failed '${name}': ${e.message}`); }
    });
  }

  async rebuild(providerNames: string[]): Promise<void> {
    const current = new Set(this.vendors.keys());
    for (const name of current) { if (!providerNames.includes(name)) { try { await this.vendors.get(name)?.disconnect(); } catch (_) {} this.vendors.delete(name); } }
    for (const name of providerNames) {
      if (!current.has(name)) {
        try {
          const vendor = this.buildVendor(name);
          if (vendor) this.vendors.set(name, vendor as any);
        } catch (e: any) { logger.error(`VendorManager: failed '${name}': ${e.message}`); }
      } else {
        // Token may have changed — push it to the running vendor (I1 fix)
        try {
          const token = this.credentialStore?.getToken(name);
          const vendor: any = this.vendors.get(name);
          if (token && vendor && typeof vendor.setAccessToken === 'function') {
            // Hand the token over and let the adapter decide what to do with it. The vendor owns
            // its own transport: MStock re-opens its tick socket (the token is baked into the
            // socket URL, so a rotated token needs a new connection), while a vendor with a
            // healthy stream can simply keep it. Reconnecting from here as well would open a
            // second socket, because the adapter's connect() is still in flight.
            vendor.setAccessToken(token);
          }
        } catch (e: any) {
          logger.error(`VendorManager: failed to apply new token for '${name}': ${e.message}`);
        }
      }
    }
  }

  async connect(): Promise<void> {
    for (const [name, v] of this.vendors) { try { await v.connect(); } catch (e: any) { logger.error(`${name}: ${e.message}`); } }
  }

  async disconnect(): Promise<void> {
    for (const [, v] of this.vendors) { try { await v.disconnect(); } catch (_) {} }
  }

  handleTick(tick: any): void { if (this.onTick) this.onTick(tick); }
  getVendor(name: string): Vendor | undefined { return this.vendors.get(name.toLowerCase()); }
  subscribe(symbols: string[]): void {
    this.vendors.forEach(v => { try { v.subscribe(symbols); } catch (_) {} });
  }
  /** Subscribe per-vendor token lists (I3 fix — one list per vendor, not broadcast) */
  subscribePerVendor(tokenMaps: Record<string, string[]>): void {
    this.vendors.forEach((v, name) => {
      const tokens = tokenMaps[name];
      if (tokens && tokens.length > 0) {
        try { v.subscribe(tokens); } catch (_) {}
        console.log(`VendorManager: ${name} subscribed to ${tokens.length} instruments`);
      } else {
        console.warn(`VendorManager: ${name} has no instrument tokens — skipping subscribe`);
      }
    });
  }
  isConnected(): boolean { for (const v of this.vendors.values()) { if (v.isConnected()) return true; } return false; }
}

module.exports = { VendorManager };
