const { BaseMapper } = require('./base');

/**
 * MStock TypeB tick → InternalTick.
 *
 * The field names below come from the SDK's `FeedData` interface — the shape actually emitted
 * by `MTicker.onBroadcastReceived`. The previous mapper read `data.Token`, `data.LastTradedPrice`
 * and `data.VolumeTradedToday`, none of which exist on that object: the token resolved to
 * `undefined`, `getSymbol()` returned null, and **every single tick was silently dropped**. Auth
 * was not the only reason no MStock data ever reached the system.
 *
 * The SDK subscribes in mode 3 (SNAP), so ticks carry open interest and full depth — not just a
 * price. We keep them: OI drives the option-chain view, and bid/ask is what a scalper actually
 * pays. Values absent from a given packet stay `undefined` rather than 0 — an unknown OI is not
 * zero OI (rule 13).
 */
class MStockMapper extends BaseMapper {
  constructor() {
    super('mstock');
  }

  map(data) {
    if (!data) return null;

    const token = data.InstrumentToken;
    const systemSymbol = this.getSymbol(token);
    if (!systemSymbol) return null; // not a symbol we subscribed to

    const bestBid = Array.isArray(data.Bids) && data.Bids.length ? data.Bids[0] : null;
    const bestAsk = Array.isArray(data.Offers) && data.Offers.length ? data.Offers[0] : null;

    const num = (v) => (v === undefined || v === null ? undefined : this.parseNumber(v));
    const ts = data.Timestamp || data.LastTradeTime;

    return {
      symbol: systemSymbol,
      exchange: 'NSE',
      timestamp: ts ? new Date(ts).getTime() : Date.now(),

      // Core pricing
      ltp: this.parseNumber(data.LastPrice),
      volume: num(data.Volume),
      lastQty: num(data.LastQuantity),
      avgPrice: num(data.AveragePrice),
      change: num(data.Change),

      // OHLC
      open: num(data.Open),
      high: num(data.High),
      low: num(data.Low),
      close: num(data.Close),

      // Order-book pressure (SNAP mode)
      buyQty: num(data.BuyQuantity),
      sellQty: num(data.SellQuantity),
      bid: bestBid ? num(bestBid.Price) : undefined,
      ask: bestAsk ? num(bestAsk.Price) : undefined,
      bidQty: bestBid ? num(bestBid.Quantity) : undefined,
      askQty: bestAsk ? num(bestAsk.Quantity) : undefined,

      // Open interest — the options signal MStock ticks DO carry (IV/greeks they do not)
      oi: num(data.OI),
      oiDayHigh: num(data.OIDayHigh),
      oiDayLow: num(data.OIDayLow),

      // Meta
      vendor: 'mstock',
      token: String(token),
    };
  }
}

module.exports = { MStockMapper };
