/**
 * FIIDIIScraper
 *
 * Scrapes FII/DII net investment data from NSE/MoneyControl as an advisory input.
 * Implements AltDataAdapter contract.
 *
 * RULES:
 * - Advisory only: tints regime, never blocks trading
 * - If scraper breaks, system continues on price + breadth
 * - Polls every 5 minutes (lower cadence than market data)
 */
const { AltDataAdapter } = require('./AltDataAdapter');
const { logger } = require('../utils/logger');

class FIIDIIScraper extends AltDataAdapter {
  constructor(options = {}) {
    super({
      name: 'fii-dii',
      reliability: 'medium',
      pollIntervalMs: options.pollIntervalMs || 300000,
      ...options,
    });
    this.axios = null;
  }

  async fetch() {
    try {
      // Lazy-load axios
      if (!this.axios) {
        this.axios = require('axios');
      }

      // Try NSE API first (more reliable)
      const data = await this.fetchFromNSE();
      if (data) return data;

      // Fallback to Redis cached value (set by another source)
      return this.fetchFromRedis();
    } catch (err) {
      logger.warn(`FIIDIIScraper: Fetch failed: ${err.message}`);
      return null;
    }
  }

  async fetchFromNSE() {
    try {
      const resp = await this.axios.get(
        'https://www.nseindia.com/api/fii-dii-derivatives-statistics',
        {
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
          },
          timeout: 10000,
        }
      );

      // NSE returns array of daily FII/DII activity
      const records = resp.data;
      if (!Array.isArray(records) || records.length === 0) return null;

      const latest = records[records.length - 1];
      return {
        date: latest.date || latest.DATE,
        fii_net: latest.fiiNetValue ? parseFloat(latest.fiiNetValue) : null,
        dii_net: latest.diiNetValue ? parseFloat(latest.diiNetValue) : null,
        fii_index_futures: latest.fiiIndexFut ? parseFloat(latest.fiiIndexFut) : null,
        fii_stock_futures: latest.fiiStockFut ? parseFloat(latest.fiiStockFut) : null,
        source: 'nse-api',
      };
    } catch (err) {
      return null;
    }
  }

  async fetchFromRedis() {
    try {
      if (!this.redisClient) return null;
      const raw = await this.redisClient.get('alt:fii-dii:latest');
      if (!raw) return null;
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {
      return null;
    }
  }
}

module.exports = { FIIDIIScraper };
