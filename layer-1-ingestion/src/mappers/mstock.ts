const { BaseMapper } = require('./base');

class MStockMapper extends BaseMapper {
  constructor() {
    super('mstock');
  }

  map(data) {
    // 1. Resolve Symbol
    // MStock Header: Token is usually in 'Token' or 'Symbol' depending on packet type
    const token = data.Token || data.Symbol || data.DispSym;
    const systemSymbol = this.getSymbol(token);

    if (!systemSymbol) {
      // logger.debug(`MStockMapper: Unknown Token ${token}`);
      return null; // Skip unknown symbols
    }

    // 2. Map Fields to InternalTick
    return {
      symbol: systemSymbol,
      exchange: data.Exc || 'NSE',
      timestamp: data.ExchangeTimestamp ? parseInt(data.ExchangeTimestamp) : Date.now(),

      // Core Pricing
      ltp: this.parseNumber(data.LastTradedPrice || data.LTP),
      volume: this.parseNumber(data.VolumeTradedToday || data.Vol),

      // OHLC
      open: this.parseNumber(data.Open),
      high: this.parseNumber(data.High),
      low: this.parseNumber(data.Low),
      close: this.parseNumber(data.Close),

      // Meta
      vendor: 'mstock',
      token: String(token),
    };
  }
}

module.exports = { MStockMapper };
