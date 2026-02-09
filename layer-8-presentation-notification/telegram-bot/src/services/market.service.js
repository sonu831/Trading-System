const redis = require('../core/redis');
const logger = require('../core/logger');
const stringSimilarity = require('string-similarity');

// Nifty50 symbols - loaded from Layer 7 API (single source of truth)
let NIFTY_50 = [];
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://backend-api:4000';

// Initialize symbols from API
async function loadSymbols() {
  try {
    const response = await fetch(`${BACKEND_API_URL}/api/v1/stocks/symbols`);
    if (response.ok) {
      const data = await response.json();
      NIFTY_50 = data.symbols || [];
      logger.info(`Loaded ${NIFTY_50.length} symbols from Layer 7 API`);
    } else {
      logger.warn('Failed to load symbols from API, using fallback');
      NIFTY_50 = getFallbackSymbols();
    }
  } catch (err) {
    logger.warn({ err }, 'API unavailable, using fallback symbols');
    NIFTY_50 = getFallbackSymbols();
  }
}

// Fallback for when API is unavailable (e.g., during startup)
function getFallbackSymbols() {
  return [
    'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'SBIN',
    'BHARTIARTL', 'KOTAKBANK', 'ITC', 'LT', 'AXISBANK', 'BAJFINANCE', 'ASIANPAINT',
    'MARUTI', 'HCLTECH', 'TITAN', 'WIPRO', 'SUNPHARMA', 'ULTRACEMCO', 'ONGC',
    'NTPC', 'POWERGRID', 'TATAMOTORS', 'M&M', 'BAJAJFINSV', 'ADANIPORTS', 'COALINDIA',
    'TATASTEEL', 'TECHM', 'JSWSTEEL', 'INDUSINDBK', 'HINDALCO', 'DRREDDY', 'DIVISLAB',
    'CIPLA', 'GRASIM', 'BRITANNIA', 'NESTLEIND', 'EICHERMOT', 'APOLLOHOSP', 'BPCL',
    'HEROMOTOCO', 'SBILIFE', 'HDFCLIFE', 'BAJAJ-AUTO', 'TATACONSUM', 'ADANIENT', 'LTIM', 'SHRIRAMFIN',
  ];
}

// Load symbols on module load
loadSymbols();

class MarketService {
  constructor() {
    this.redis = redis;
  }

  // Refresh symbols from API (call periodically or on demand)
  async refreshSymbols() {
    await loadSymbols();
  }

  getSymbols() {
    return NIFTY_50;
  }

  findClosestSymbol(input) {
    input = input.toUpperCase();
    if (NIFTY_50.includes(input)) return { symbol: input, original: true };

    const matches = stringSimilarity.findBestMatch(input, NIFTY_50);
    const best = matches.bestMatch;

    if (best.rating > 0.4) {
      return { symbol: best.target, original: false, confidence: best.rating };
    }
    return null;
  }

  async getMarketSnapshot() {
    try {
      const data = await this.redis.get('market_view:latest');
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      logger.error({ err }, 'Error fetching market snapshot');
      return null;
    }
  }

  formatStock(s) {
    const change = s.change_pct ? s.change_pct.toFixed(2) : '0.00';
    const price = s.ltp ? s.ltp.toLocaleString('en-IN') : '0';
    // Add arrow
    const arrow = s.change_pct >= 0 ? '🟢' : '🔴';
    return `${arrow} *${s.symbol}*: ${change}% (₹${price})`;
  }

  async getTopGainers(limit = 10) {
    const market = await this.getMarketSnapshot();
    if (!market || !market.top_gainers) return [];
    return market.top_gainers.slice(0, limit);
  }

  async getTopLosers(limit = 10) {
    const market = await this.getMarketSnapshot();
    if (!market || !market.top_losers) return [];
    return market.top_losers.slice(0, limit);
  }

  async getMostActive(limit = 10) {
    const market = await this.getMarketSnapshot();
    if (!market) return [];
    // Prefer most_active, fallback to gainers if missing
    const movers = market.most_active || market.top_gainers || [];
    return movers.slice(0, limit);
  }
}

module.exports = new MarketService();
