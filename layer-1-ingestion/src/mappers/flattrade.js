const { BaseMapper } = require('./base');

class FlatTradeMapper extends BaseMapper {
  map(data) {
    // Based on Noren API / Piconnect_v2
    // Common fields: lp (LTP), v (Volume), ts (Symbol), pc (Percent Change)
    return {
      symbol: data.ts, // Trading Symbol (e.g., TCS-EQ)
      exchange: data.e, // Exchange (e.g., NSE)
      timestamp: data.ft ? new Date(Number(data.ft) * 1000).getTime() : Date.now(), // ft is epoch? verify
      ltp: this.parseNumber(data.lp),
      volume: this.parseNumber(data.v),
      bid: this.parseNumber(data.bp1), // Best Bid
      ask: this.parseNumber(data.sp1), // Best Ask
      open: this.parseNumber(data.o),
      high: this.parseNumber(data.h),
      low: this.parseNumber(data.l),
      close: this.parseNumber(data.c),
      vendor: 'flattrade',
    };
  }
}

module.exports = { FlatTradeMapper };
