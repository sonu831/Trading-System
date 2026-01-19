/**
 * Symbol Registry (Singleton)
 * Central authority for resolving Vendor Tokens to System Symbols.
 * Loads 'nifty50_shared.json' to build internal lookup maps.
 */

const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');

class SymbolRegistry {
  constructor() {
    this.tokenMaps = {
      kite: new Map(),
      mstock: new Map(),
      flattrade: new Map(),
    };
    this.symbolMap = new Map(); // System Symbol -> Full Info
    this.isLoaded = false;
  }

  /**
   * Load and parse the shared symbol map
   * @param {string} [customPath] - Optional override path
   */
  load(customPath) {
    if (this.isLoaded) return;

    try {
      // 1. Determine Path (Priority: Arg > Env > Default Local/Docker)
      let mapPath = customPath;

      if (!mapPath) {
        // Docker path or relative path
        const potentials = [
          path.resolve('/app/vendor/nifty50_shared.json'), // Docker
          path.resolve(__dirname, '../../../vendor/nifty50_shared.json'), // Local dev relative
          path.resolve(process.cwd(), 'vendor/nifty50_shared.json'), // Root relative
        ];

        for (const p of potentials) {
          if (fs.existsSync(p)) {
            mapPath = p;
            break;
          }
        }
      }

      if (!mapPath || !fs.existsSync(mapPath)) {
        throw new Error(`Master Map not found. Scanned paths.`);
      }

      logger.info(`📋 SymbolRegistry: Loading map from ${mapPath}`);
      const rawData = fs.readFileSync(mapPath, 'utf-8');
      const items = JSON.parse(rawData);

      // 2. Build Lookup Maps
      let count = 0;
      items.forEach((item) => {
        // Store master info
        this.symbolMap.set(item.symbol, item);

        // Map Vendor Tokens -> System Symbol
        if (item.tokens) {
          if (item.tokens.kite) this.tokenMaps.kite.set(String(item.tokens.kite), item.symbol);
          if (item.tokens.mstock)
            this.tokenMaps.mstock.set(String(item.tokens.mstock), item.symbol);
          if (item.tokens.flattrade)
            this.tokenMaps.flattrade.set(String(item.tokens.flattrade), item.symbol);
        }
        count++;
      });

      this.isLoaded = true;
      logger.info(
        `✅ SymbolRegistry: Loaded ${count} symbols. (Kite: ${this.tokenMaps.kite.size}, MStock: ${this.tokenMaps.mstock.size})`
      );
    } catch (e) {
      logger.error(`❌ SymbolRegistry Load Failed: ${e.message}`);
      // Don't crash here, might be retried or optional?
      // User requirement implies critical, so we might want to crash or handle upstream.
    }
  }

  /**
   * Get System Symbol from Vendor Token
   * @param {string} vendor - 'kite', 'mstock', 'flattrade'
   * @param {string|number} token - Vendor specific token
   * @returns {string|null} - System Symbol (e.g. 'RELIANCE') or null
   */
  getSymbol(vendor, token) {
    if (!token) return null;
    const map = this.tokenMaps[vendor.toLowerCase()];
    if (!map) return null;
    return map.get(String(token)) || null;
  }

  /**
   * Get Full Info for System Symbol
   * @param {string} symbol - 'RELIANCE'
   */
  getInfo(symbol) {
    return this.symbolMap.get(symbol);
  }
}

// Singleton Instance
const registry = new SymbolRegistry();
module.exports = { SymbolRegistry: registry };
