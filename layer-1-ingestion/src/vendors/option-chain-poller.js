const axios = require('axios');
const { logger } = require('../utils/logger');
const { FLATTRADE_BASE_URL, norenBody, isNorenOk, norenError } = require('../utils/flattrade');
const { nextWeeklyExpiryIST } = require('../utils/ist-time');

const STRIKE_STEPS = { NIFTY: 50, BANKNIFTY: 100 };
const CHAIN_DEPTH = 5; // ATM ± 5 strikes => 22 contracts per poll

/**
 * OptionChainPoller — snapshots the ATM±N option chain from FlatTrade (Pi Connect).
 *
 * Verified against the official Pi Connect docs. Four defects were fixed here; each has a
 * regression assertion in `tests/verify-flattrade-urls.js`:
 *
 *   1. URL was `.../PiConnectTP/REST/GetQuotes` — both the base and the `/REST/` segment are
 *      wrong. It is `https://piconnect.flattrade.in/PiConnectAPI/GetQuotes`.
 *   2. `jKey` was set to the **api_key**. `jKey` is the *session token* from the login flow.
 *   3. `token` was set to the **trading symbol**. GetQuotes resolves a numeric contract token;
 *      a symbol must be mapped first (scrip master / SearchScrips).
 *   4. Every failure was swallowed into `logger.debug(...) -> return null`, so a 100% failure
 *      rate was indistinguishable from "market closed". That is why this poller was recorded
 *      as "unverified" rather than "broken".
 *
 * Fail-closed: without a `resolveToken` port we do NOT guess. We refuse to poll.
 */
class OptionChainPoller {
  /**
   * @param {object} options
   * @param {(symbol:string)=>Promise<string|number|null>} options.resolveToken  tsym -> numeric contract token
   * @param {string} [options.sessionToken]  FlatTrade jKey (NOT the api_key)
   */
  constructor(options = {}) {
    this.name = 'optionchain';
    this.interval = null;
    this.pollIntervalMs = options.pollIntervalMs || Number(process.env.OPTION_CHAIN_POLL_MS) || 3000;
    this.concurrency = options.concurrency || Number(process.env.OPTION_CHAIN_CONCURRENCY) || 4;
    this.redisClient = options.redisClient;
    this.kafkaProducer = options.kafkaProducer;
    this.kafkaTopic = options.kafkaTopic || 'option-chain';
    this.onSnapshot = options.onSnapshot;

    this.userId = options.userId || process.env.FLATTRADE_USER_ID;
    // jKey — the session token from the login flow, NEVER the api_key.
    this.sessionToken = options.sessionToken || process.env.FLATTRADE_TOKEN;
    this.baseUrl = options.baseUrl || FLATTRADE_BASE_URL;

    // Port: maps a trading symbol to the numeric contract token GetQuotes requires.
    this.resolveToken = options.resolveToken || null;
    this.tokenCache = new Map();

    this.running = false;
    this.stats = { polls: 0, snapshots: 0, quotesOk: 0, quotesFailed: 0, errors: 0, lastError: null };
    this._warnedNoResolver = false;

    logger.info({ baseUrl: this.baseUrl, pollIntervalMs: this.pollIntervalMs }, 'OptionChainPoller: initialized');
  }

  /** Everything required to make a single successful call. Missing pieces are fatal, not silent. */
  preflight() {
    const missing = [];
    if (!this.userId) missing.push('FLATTRADE_USER_ID');
    if (!this.sessionToken) missing.push('FLATTRADE_TOKEN (jKey — not the api_key)');
    if (typeof this.resolveToken !== 'function') missing.push('resolveToken(symbol) port');
    return missing;
  }

  async start() {
    if (this.running) return;

    const missing = this.preflight();
    if (missing.length) {
      // Fail closed (rule 11). Silently polling with a symbol-as-token produced a 100% error
      // rate that looked like "no data".
      logger.error({ missing }, 'OptionChainPoller: refusing to start — missing required inputs');
      throw new Error(`OptionChainPoller cannot start. Missing: ${missing.join(', ')}`);
    }

    this.running = true;
    logger.info('OptionChainPoller: starting...');
    await this.poll();
    this.interval = setInterval(() => this.poll().catch((err) => logger.error({ err }, 'poll failed')), this.pollIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info({ stats: this.stats }, 'OptionChainPoller: stopped');
  }

  async poll() {
    if (!this.running) return;
    this.stats.polls++;

    try {
      const underlying = process.env.OPTION_UNDERLYING || 'NIFTY';
      const spot = await this.getSpotPrice(underlying);
      if (!spot || spot <= 0) {
        logger.debug('OptionChainPoller: no spot price yet, skipping');
        return;
      }

      const expiry = nextWeeklyExpiryIST();
      const strikeStep = STRIKE_STEPS[underlying] || 50;
      const atmStrike = Math.round(spot / strikeStep) * strikeStep;

      const symbols = [];
      for (let i = -CHAIN_DEPTH; i <= CHAIN_DEPTH; i++) {
        const strike = atmStrike + i * strikeStep;
        symbols.push(this.optionSymbol(underlying, expiry, strike, 'CE'));
        symbols.push(this.optionSymbol(underlying, expiry, strike, 'PE'));
      }

      // Bounded concurrency: 22 serial requests every 3s trips the broker's rate limits.
      const results = (await this.mapLimit(symbols, this.concurrency, (s) => this.fetchQuote(s))).filter(Boolean);

      const failed = symbols.length - results.length;
      this.stats.quotesOk += results.length;
      this.stats.quotesFailed += failed;

      if (results.length === 0) {
        // Total failure is an ERROR, not a debug line. This is the whole point of the rewrite.
        this.stats.errors++;
        logger.error(
          { underlying, attempted: symbols.length, lastError: this.stats.lastError },
          'OptionChainPoller: EVERY quote failed — chain snapshot not published'
        );
        return;
      }
      if (failed > 0) {
        logger.warn({ failed, attempted: symbols.length }, 'OptionChainPoller: partial chain');
      }

      this.stats.snapshots++;
      const snapshot = {
        time: new Date().toISOString(),
        underlying,
        spot,
        expiry: expiry.toISOString(),
        atmStrike,
        options: results,
      };
      await this.publishSnapshot(snapshot);
      if (this.onSnapshot) this.onSnapshot(snapshot);
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      logger.error({ err }, 'OptionChainPoller: poll error');
    }
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

  async getSpotPrice(symbol) {
    if (!this.redisClient) return null;
    try {
      const data = await this.redisClient.get(`ltp:${symbol}`);
      if (data) return JSON.parse(data).price;
    } catch (err) {
      logger.warn({ err, symbol }, 'OptionChainPoller: redis spot read failed');
    }
    return null;
  }

  /** Map tsym -> numeric contract token via the injected port, memoised. */
  async tokenFor(symbol) {
    if (this.tokenCache.has(symbol)) return this.tokenCache.get(symbol);
    if (typeof this.resolveToken !== 'function') {
      if (!this._warnedNoResolver) {
        this._warnedNoResolver = true;
        logger.error('OptionChainPoller: no resolveToken port — refusing to send a symbol as a token');
      }
      return null;
    }
    const token = await this.resolveToken(symbol);
    if (token) this.tokenCache.set(symbol, String(token));
    return token ? String(token) : null;
  }

  async fetchQuote(symbol) {
    const token = await this.tokenFor(symbol);
    if (!token) {
      this.stats.lastError = `no contract token for ${symbol}`;
      return null;
    }

    try {
      // GetQuotes takes the numeric contract token, not the trading symbol.
      const body = norenBody({ uid: this.userId, exch: 'NFO', token }, this.sessionToken);
      const res = await axios.post(`${this.baseUrl}/GetQuotes`, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      if (!isNorenOk(res.data)) {
        this.stats.lastError = norenError(res.data, 'GetQuotes not Ok');
        return null;
      }
      return this.parseQuote(res.data, symbol);
    } catch (err) {
      this.stats.lastError = err.response?.data?.emsg || err.message;
      return null;
    }
  }

  parseQuote(data, symbol) {
    return {
      symbol,
      strike: this.extractStrike(symbol),
      option_type: symbol.endsWith('CE') ? 'CE' : 'PE',
      ltp: parseFloat(data.lp || 0),
      bid: parseFloat(data.bp || 0),
      ask: parseFloat(data.sp || 0),
      open_interest: parseInt(data.oi || 0, 10),
      volume: parseInt(data.v || 0, 10),
      iv: parseFloat(data.iv || 0),
    };
  }

  extractStrike(symbol) {
    const match = symbol.match(/(\d+)(CE|PE)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  optionSymbol(underlying, expiry, strike, type) {
    const monthCodes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const yy = String(expiry.getUTCFullYear()).slice(2);
    const mm = monthCodes[expiry.getUTCMonth()];
    const dd = String(expiry.getUTCDate()).padStart(2, '0');
    const stk = String(strike).padStart(5, '0');
    return `${underlying}${yy}${mm}${dd}${stk}${type}`;
  }

  async publishSnapshot(snapshot) {
    if (!this.kafkaProducer || !this.kafkaTopic) return;
    try {
      await this.kafkaProducer.send({
        topic: this.kafkaTopic,
        messages: [{
          key: snapshot.underlying,
          value: JSON.stringify(snapshot),
          timestamp: Date.now().toString(),
          headers: { source: 'option-chain-poller', version: '1.0' },
        }],
      });
    } catch (err) {
      logger.error({ err }, 'OptionChainPoller: kafka publish failed');
    }
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { OptionChainPoller };
