const logger = require('./utils/logger');

/**
 * QuoteFeed — tracks live quotes for the option symbols we actually hold.
 *
 * Symbols must be registered via primeSymbol() when a position is opened, otherwise
 * poll() has nothing to refresh and getQuote() returns null forever (this was a bug:
 * positions never received a price and always exited on the time-stop with 0 P&L).
 */
class QuoteFeed {
  constructor(config, oms) {
    this.oms = oms;
    this.pollMs = config.quotes.pollMs;
    this.source = config.quotes.source;
    this.interval = null;
    this.lastQuotes = {};
  }

  start() {
    logger.info({ source: this.source }, 'QuoteFeed: starting');
    this.poll();
    this.interval = setInterval(() => this.poll(), this.pollMs);
  }

  async poll() {
    // Override in subclasses.
  }

  ensureSymbol(symbol, seedLtp = 0) {
    if (!symbol) return null;
    if (!this.lastQuotes[symbol]) {
      this.lastQuotes[symbol] = {
        ltp: seedLtp,
        bid: seedLtp * 0.998,
        ask: seedLtp * 1.002,
        oi: 0,
      };
    }
    return this.lastQuotes[symbol];
  }

  /**
   * Register a symbol and return its best-available quote NOW (used to price an entry).
   * @param {string} symbol
   * @param {number} seedLtp - fallback premium estimate (synthetic mode only)
   */
  async primeSymbol(symbol, seedLtp = 0) {
    return this.ensureSymbol(symbol, seedLtp);
  }

  releaseSymbol(symbol) {
    delete this.lastQuotes[symbol];
  }

  getQuote(symbol) {
    if (!symbol) return null;
    return this.lastQuotes[symbol] || null;
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }
}

/**
 * Offline/dev only. A random walk around a seeded premium.
 * NEVER meaningful for evaluating a strategy — paper mode should use BrokerQuoteFeed.
 */
class SyntheticQuoteFeed extends QuoteFeed {
  constructor(config, oms) {
    super(config, oms);
    this.source = 'synthetic';
  }

  poll() {
    for (const symbol of Object.keys(this.lastQuotes)) {
      const q = this.lastQuotes[symbol];
      if (!(q.ltp > 0)) continue;
      const change = q.ltp * (Math.random() - 0.5) * 0.02; // options move far more than 0.2%
      q.ltp = Math.max(0.05, q.ltp + change);
      q.bid = q.ltp * 0.998;
      q.ask = q.ltp * 1.002;
    }
  }

  setQuote(symbol, ltp) {
    this.lastQuotes[symbol] = { ltp, bid: ltp * 0.998, ask: ltp * 1.002, oi: 0 };
  }
}

class BrokerQuoteFeed extends QuoteFeed {
  constructor(config, oms) {
    super(config, oms);
    this.source = 'broker';
  }

  async poll() {
    for (const symbol of Object.keys(this.lastQuotes)) {
      try {
        const quote = await this.oms.getQuote(symbol);
        if (quote && quote.ltp > 0) this.lastQuotes[symbol] = quote;
      } catch (err) {
        logger.debug({ err, symbol }, 'QuoteFeed: poll error');
      }
    }
  }

  /** Fetch the real premium immediately so the entry is priced off the broker, not a guess. */
  async primeSymbol(symbol, seedLtp = 0) {
    this.ensureSymbol(symbol, seedLtp);
    try {
      const quote = await this.oms.getQuote(symbol);
      if (quote && quote.ltp > 0) this.lastQuotes[symbol] = quote;
    } catch (err) {
      logger.warn({ err, symbol }, 'QuoteFeed: primeSymbol failed');
    }
    return this.getQuote(symbol);
  }

  setSymbol(symbol) {
    this.ensureSymbol(symbol, 0);
  }
}

module.exports = { QuoteFeed, SyntheticQuoteFeed, BrokerQuoteFeed };
