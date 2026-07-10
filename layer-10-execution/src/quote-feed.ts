/** QuoteFeed — tracks live quotes for held option symbols. */
const logger = require('./utils/logger');

interface Quote { ltp: number; bid: number; ask: number; oi: number; }

class QuoteFeed {
  oms: any; pollMs: number; source: string; interval: ReturnType<typeof setInterval> | null; lastQuotes: Record<string, Quote>;

  constructor(config: any, oms: any) {
    this.oms = oms; this.pollMs = config.quotes.pollMs; this.source = config.quotes.source;
    this.interval = null; this.lastQuotes = {};
  }

  start(): void { logger.info({ source: this.source }, 'QuoteFeed: starting'); this.poll(); this.interval = setInterval(() => this.poll(), this.pollMs); }
  async poll(): Promise<void> {}

  ensureSymbol(symbol: string, seedLtp = 0): Quote | null {
    if (!symbol) return null;
    if (!this.lastQuotes[symbol]) this.lastQuotes[symbol] = { ltp: seedLtp, bid: seedLtp * 0.998, ask: seedLtp * 1.002, oi: 0 };
    return this.lastQuotes[symbol];
  }

  async primeSymbol(symbol: string, seedLtp = 0): Promise<Quote | null> { return this.ensureSymbol(symbol, seedLtp); }
  releaseSymbol(symbol: string): void { delete this.lastQuotes[symbol]; }
  getQuote(symbol: string): Quote | null { return this.lastQuotes[symbol] || null; }
  stop(): void { if (this.interval) { clearInterval(this.interval); this.interval = null; } }
}

class SyntheticQuoteFeed extends QuoteFeed {
  constructor(config: any) { super(config, null); this.source = 'synthetic'; }
  async poll(): Promise<void> {
    for (const sym of Object.keys(this.lastQuotes)) {
      const q = this.lastQuotes[sym];
      const drift = (Math.random() - 0.5) * q.ltp * 0.002;
      q.ltp += drift; q.bid = q.ltp * 0.998; q.ask = q.ltp * 1.002;
    }
  }
}

class BrokerQuoteFeed extends QuoteFeed {
  constructor(config: any, oms: any) { super(config, oms); this.source = 'broker'; }
  async poll(): Promise<void> {
    for (const sym of Object.keys(this.lastQuotes)) {
      try { const q = await this.oms.getQuote(sym); if (q?.ltp != null) this.lastQuotes[sym] = { ltp: q.ltp, bid: q.bid ?? q.ltp * 0.998, ask: q.ask ?? q.ltp * 1.002, oi: q.oi ?? 0 }; }
      catch (err: any) { logger.warn({ err, symbol: sym }, 'QuoteFeed: poll failed'); }
    }
  }
}

export = { QuoteFeed, SyntheticQuoteFeed, BrokerQuoteFeed };
