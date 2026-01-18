const { BaseMapper } = require('./base');

class MStockMapper extends BaseMapper {
  map(data) {
    // Mapping based on User Spec (Quote Packet Structure)
    // Assuming SDK parses binary to these keys
    return {
      symbol: data.Symbol || data.DispSym || data.Token,
      exchange: data.Exc || 'NSE',
      timestamp: data.ExchangeTimestamp || Date.now(),

      // Core Data
      ltp: this.parseNumber(data.LTP || data.LastTradedPrice),
      lastTradedQty: this.parseNumber(data.LastTradedQty),
      avgTradedPrice: this.parseNumber(data.AverageTradedPrice),
      volume: this.parseNumber(data.VolumeTradedToday || data.Vol),

      // OHLC
      open: this.parseNumber(data.Open),
      high: this.parseNumber(data.High),
      low: this.parseNumber(data.Low),
      close: this.parseNumber(data.Close), // Previous Close

      // Market Depth / Stats
      totalBuyQty: this.parseNumber(data.TotalBuyQty),
      totalSellQty: this.parseNumber(data.TotalSellQty),
      openInterest: this.parseNumber(data.OpenInterest),

      // Limits
      upperCircuit: this.parseNumber(data.UpperCircuitLimit),
      lowerCircuit: this.parseNumber(data.LowerCircuitLimit),
      high52Week: this.parseNumber(data['52WeekHigh']),
      low52Week: this.parseNumber(data['52WeekLow']),

      vendor: 'mstock',
    };
  }
}

module.exports = { MStockMapper };
