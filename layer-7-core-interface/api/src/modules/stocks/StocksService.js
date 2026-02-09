/**
 * Stocks Service - Uses shared loader for Nifty50 data
 * Single source of truth via shared/stocks/loader.js
 */
const path = require('path');
const stockLoader = require('../../../../../shared/stocks/loader');

class StocksService {
  /**
   * Get all Nifty50 symbols
   */
  async getSymbols() {
    return stockLoader.getSymbols();
  }

  /**
   * Get all stocks with full metadata
   */
  async getAllStocks() {
    return stockLoader.getAllStocks();
  }

  /**
   * Get stock by symbol
   */
  async getStockBySymbol(symbol) {
    return stockLoader.getStockBySymbol(symbol);
  }

  /**
   * Get sector mapping { symbol: sector }
   */
  async getSectorMap() {
    return stockLoader.getSectorMap();
  }

  /**
   * Get stocks grouped by sector
   */
  async getStocksBySector() {
    return stockLoader.getStocksBySector();
  }

  /**
   * Get all unique sectors
   */
  async getSectors() {
    return stockLoader.getSectors();
  }

  /**
   * Get broker token for symbol
   */
  async getToken(symbol, broker = 'kite') {
    return stockLoader.getToken(symbol, broker);
  }
}

module.exports = StocksService;
