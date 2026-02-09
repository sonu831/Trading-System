/**
 * Nifty50 Stock Loader Utilities
 * Single source of truth for stock data across all layers
 * 
 * Usage:
 *   const { getSymbols, getSectorMap, getStockBySymbol } = require('./loader');
 *   
 *   // Get all symbols
 *   const symbols = getSymbols();  // ['RELIANCE', 'TCS', ...]
 *   
 *   // Get sector mapping
 *   const sectors = getSectorMap();  // { 'RELIANCE': 'Energy', ... }
 *   
 *   // Get full stock info
 *   const stock = getStockBySymbol('RELIANCE');
 */

const fs = require('fs');
const path = require('path');

// Cache for loaded data
let _stockData = null;

/**
 * Load and cache the stock data from JSON
 */
function loadData() {
  if (_stockData) return _stockData;
  
  const jsonPath = path.join(__dirname, 'nifty50_shared.json');
  _stockData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  return _stockData;
}

/**
 * Get all Nifty50 symbols as array
 * @returns {string[]} Array of symbols
 */
function getSymbols() {
  return loadData().map(s => s.symbol);
}

/**
 * Get full stock data array
 * @returns {Array} Array of stock objects with symbol, sector, tokens
 */
function getAllStocks() {
  return loadData();
}

/**
 * Get stock by symbol
 * @param {string} symbol - Stock symbol (e.g., 'RELIANCE')
 * @returns {Object|null} Stock object or null if not found
 */
function getStockBySymbol(symbol) {
  return loadData().find(s => s.symbol === symbol) || null;
}

/**
 * Get sector mapping { symbol: sector }
 * @returns {Object} Map of symbol to sector
 */
function getSectorMap() {
  const map = {};
  loadData().forEach(s => {
    map[s.symbol] = s.sector;
  });
  return map;
}

/**
 * Get stocks grouped by sector
 * @returns {Object} Map of sector to array of symbols
 */
function getStocksBySector() {
  const sectors = {};
  loadData().forEach(s => {
    if (!sectors[s.sector]) {
      sectors[s.sector] = [];
    }
    sectors[s.sector].push(s.symbol);
  });
  return sectors;
}

/**
 * Get all unique sectors
 * @returns {string[]} Array of sector names
 */
function getSectors() {
  return [...new Set(loadData().map(s => s.sector))];
}

/**
 * Get broker token for symbol
 * @param {string} symbol - Stock symbol
 * @param {string} broker - Broker name ('kite' or 'mstock')
 * @returns {string|null} Token or null
 */
function getToken(symbol, broker = 'kite') {
  const stock = getStockBySymbol(symbol);
  return stock?.tokens?.[broker] || null;
}

module.exports = {
  getSymbols,
  getAllStocks,
  getStockBySymbol,
  getSectorMap,
  getStocksBySector,
  getSectors,
  getToken,
};
