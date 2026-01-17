const { BaseMapper } = require('./base');

class MStockMapper extends BaseMapper {
  map(data) {
    // MStock Type A usually returns data in keys like 'LastTradedPrice', 'Symbol' etc.
    // Adjust based on actual API response from documentation
    return {
      symbol: data.Symbol || data.DispSym, // Display Symbol
      exchange: data.Exc || 'NSE',
      timestamp: Date.now(), // MStock might not send tick timestamp in polling
      ltp: this.parseNumber(data.LTP),
      volume: this.parseNumber(data.Vol),
      bid: this.parseNumber(data.BidPrice),
      ask: this.parseNumber(data.AskPrice),
      open: this.parseNumber(data.Open),
      high: this.parseNumber(data.High),
      low: this.parseNumber(data.Low),
      close: this.parseNumber(data.Close), // Previous Close
      vendor: 'mstock',
    };
  }
}

module.exports = { MStockMapper };
