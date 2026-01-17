const { BaseMapper } = require('./base');

class KiteMapper extends BaseMapper {
  /**
   * Maps Kite binary tick or JSON quote to internal Schema
   * @param {Object} data
   */
  map(data) {
    // Kite often returns a structure like:
    // { instrument_token: 123, last_price: 1500, timestamp: Date... }

    // If it's already parsed by kiteconnect:
    return {
      symbol: this.getSymbol(data.instrument_token),
      exchange: 'NSE', // Default or look up
      timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
      ltp: this.parseNumber(data.last_price),
      volume: this.parseNumber(data.volume_traded),
      bid: this.parseNumber(data.depth?.buy?.[0]?.price || 0),
      ask: this.parseNumber(data.depth?.sell?.[0]?.price || 0),
      open: this.parseNumber(data.ohlc?.open),
      high: this.parseNumber(data.ohlc?.high),
      low: this.parseNumber(data.ohlc?.low),
      close: this.parseNumber(data.ohlc?.close),
      // Vendor specific raw meta
      vendor: 'kite',
    };
  }

  getSymbol(token) {
    //In real scenario, look up token -> symbol map
    //For now return token as string if map missing
    return String(token);
  }
}

module.exports = { KiteMapper };
