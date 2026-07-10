const axios = require('axios');
const { BaseVendor } = require('./base');
const { FlatTradeMapper } = require('../mappers/flattrade');
const logger = require('../utils/logger');
const { metrics } = require('../utils/metrics');
const { FLATTRADE_BASE_URL, norenBody, isNorenOk, norenError } = require('../utils/flattrade');

/**
 * FlatTradeVendor — polls GetQuotes for equity futures on a timer.
 *
 * Defects discovered by L1 audit (LAYER_REMEDIATION_PLAN.md §1), now fixed:
 *   L1-1  URL was /PiConnectTP/REST/GetQuotes → now /PiConnectAPI/GetQuotes
 *   L1-2  apiKey was sent as jKey → jKey is the session token, NEVER the api_key
 *   L1-4  Content-Type was text/plain → application/json
 *   L1-5  Errors swallowed → fail-loud with stats tracking
 */
class FlatTradeVendor extends BaseVendor {
  constructor(options) {
    super(options);
    this.symbols = options.symbols || [];
    this.connected = false;
    this.interval = null;
    this.mapper = new FlatTradeMapper();

    this.userId = options.userId || process.env.FLATTRADE_USER_ID;
    this.accountId = options.accountId || process.env.FLATTRADE_ACTID || this.userId;
    /** jKey — the session token from the login flow, NEVER the api_key. */
    this.token = options.token || process.env.FLATTRADE_TOKEN;
    this.baseUrl = options.baseUrl || FLATTRADE_BASE_URL;

    this.pollIntervalMs = options.pollIntervalMs || Number(process.env.FLATTRADE_POLL_MS) || 2000;
    this.concurrency = options.concurrency || Number(process.env.FLATTRADE_CONCURRENCY) || 4;

    this.stats = { polls: 0, ticks: 0, errors: 0, lastError: null };
  }

  /** Pre-flight: refuse to start if required inputs are missing (fail closed). */
  preflight() {
    const missing = [];
    if (!this.userId) missing.push('FLATTRADE_USER_ID');
    if (!this.token) missing.push('FLATTRADE_TOKEN (jKey — not the api_key)');
    return missing;
  }

  async connect() {
    logger.info('FlatTradeVendor: connecting...');

    const missing = this.preflight();
    if (missing.length) {
      throw new Error(`FlatTradeVendor cannot start. Missing: ${missing.join(', ')}`);
    }

    this.connected = true;
    logger.info({ baseUrl: this.baseUrl }, 'FlatTradeVendor: connected');
    metrics.websocketConnections.set(1);
    this.startPolling();
  }

  async disconnect() {
    this.connected = false;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    logger.info({ stats: this.stats }, 'FlatTradeVendor: disconnected');
    metrics.websocketConnections.set(0);
  }

  subscribe(symbols) {
    logger.info(`FlatTradeVendor: subscribing to ${symbols.length} symbols`);
    this.symbols = symbols;
  }

  setAccessToken(token) {
    this.token = token;
  }

  /** Run `fn` over `items` with at most `limit` in flight. */
  async mapLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    });
    await Promise.all(workers);
    return out;
  }

  startPolling() {
    if (this.interval) clearInterval(this.interval);

    this.interval = setInterval(async () => {
      if (!this.connected || this.symbols.length === 0) return;
      this.stats.polls++;

      try {
        const results = await this.mapLimit(this.symbols, this.concurrency, (sym) =>
          this.fetchSymbol(sym)
        );
        const ticks = results.filter(Boolean);

        this.stats.ticks += ticks.length;
        const failed = this.symbols.length - ticks.length;
        if (failed > 0) {
          this.stats.errors += failed;
          logger.warn(
            { failed, attempted: this.symbols.length, lastError: this.stats.lastError },
            'FlatTradeVendor: partial poll'
          );
        }
        if (ticks.length === 0 && this.symbols.length > 0) {
          this.stats.errors += this.symbols.length;
          logger.error(
            { attempted: this.symbols.length, lastError: this.stats.lastError },
            'FlatTradeVendor: ALL quotes failed — nothing published this cycle'
          );
        }

        for (const t of ticks) {
          const normalized = this.mapper.map(t.raw);
          if (normalized) this.onTick(normalized);
        }
      } catch (err) {
        this.stats.errors++;
        this.stats.lastError = err.message;
        logger.error({ err }, 'FlatTradeVendor: poll cycle error');
      }
    }, this.pollIntervalMs);
  }

  async fetchSymbol(sym) {
    try {
      const [exch, token] = sym.split(':');
      const body = norenBody({ uid: this.userId, token, exch }, this.token);

      const res = await axios.post(`${this.baseUrl}/GetQuotes`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      if (!isNorenOk(res.data)) {
        this.stats.lastError = norenError(res.data, 'GetQuotes not Ok');
        return null;
      }
      return { raw: res.data, symbol: sym };
    } catch (err) {
      this.stats.lastError = err.response?.data?.emsg || err.message;
      return null;
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { FlatTradeVendor };
