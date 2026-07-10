const axios = require('axios');
const { logger } = require('../utils/logger');

const STRIKE_STEPS = { NIFTY: 50, BANKNIFTY: 100 };
const NFO_EXPIRY_WEEKDAY = 2; // Tuesday
const CHAIN_DEPTH = 5;

class OptionChainPoller {
  constructor(options = {}) {
    this.name = 'optionchain';
    this.interval = null;
    this.pollIntervalMs = options.pollIntervalMs || 3000;
    this.redisClient = options.redisClient;
    this.kafkaProducer = options.kafkaProducer;
    this.kafkaTopic = options.kafkaTopic || 'option-chain';
    this.onSnapshot = options.onSnapshot;

    // FlatTrade config
    this.apiKey = process.env.FLATTRADE_API_KEY;
    this.userId = process.env.FLATTRADE_USER_ID;
    this.baseUrl = 'https://piconnect.flattrade.in/PiConnectTP/REST/GetQuotes';
    this.running = false;
    this.stats = { polls: 0, snapshots: 0, errors: 0 };

    logger.info('OptionChainPoller: initialized');
  }

  async start() {
    if (this.running) return;
    this.running = true;
    logger.info('OptionChainPoller: starting...');
    await this.poll();
    this.interval = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stop() {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('OptionChainPoller: stopped');
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

      const expiry = this.getWeeklyExpiry();
      const strikeStep = STRIKE_STEPS[underlying] || 50;
      const atmStrike = Math.round(spot / strikeStep) * strikeStep;

      const symbols = [];
      for (let i = -CHAIN_DEPTH; i <= CHAIN_DEPTH; i++) {
        const strike = atmStrike + i * strikeStep;
        symbols.push(this.optionSymbol(underlying, expiry, strike, 'CE'));
        symbols.push(this.optionSymbol(underlying, expiry, strike, 'PE'));
      }

      const results = [];
      for (const sym of symbols) {
        const quote = await this.fetchQuote(sym);
        if (quote) results.push(quote);
      }

      if (results.length > 0) {
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
      }
    } catch (err) {
      this.stats.errors++;
      logger.error({ err }, 'OptionChainPoller: poll error');
    }
  }

  async getSpotPrice(symbol) {
    if (!this.redisClient) return null;
    try {
      const data = await this.redisClient.get(`ltp:${symbol}`);
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.price;
      }
    } catch (err) {
      logger.debug({ err }, 'OptionChainPoller: redis read error');
    }
    return null;
  }

  getWeeklyExpiry() {
    const now = new Date();
    const day = now.getDay();
    const diff = (NFO_EXPIRY_WEEKDAY + 7 - day) % 7;
    if (diff === 0) {
      // Today is expiry - check if we're past cutoff
      const cutoff = 12 * 60 + 0;
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin >= cutoff) {
        // Roll to next week
        return new Date(now.getTime() + 7 * 86400000);
      }
    }
    const expiry = new Date(now.getTime() + diff * 86400000);
    expiry.setHours(0, 0, 0, 0);
    return expiry;
  }

  optionSymbol(underlying, expiry, strike, type) {
    const monthCodes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const yy = String(expiry.getFullYear()).slice(2);
    const mm = monthCodes[expiry.getMonth()];
    const dd = String(expiry.getDate()).padStart(2, '0');
    const stk = String(strike).padStart(5, '0');
    return `${underlying}${yy}${mm}${dd}${stk}${type}`;
  }

  async fetchQuote(symbol) {
    if (!this.apiKey || !this.userId) {
      return null;
    }
    try {
      const payload = { uid: this.userId, token: symbol, exch: 'NFO' };
      const body = `jData=${JSON.stringify(payload)}&jKey=${this.apiKey}`;
      const res = await axios.post(this.baseUrl, body, {
        headers: { 'Content-Type': 'text/plain' },
        timeout: 5000,
      });
      if (res.data && res.data.stat === 'Ok') {
        return this.parseQuote(res.data, symbol);
      }
    } catch (err) {
      logger.debug({ err, symbol }, 'OptionChainPoller: quote fetch failed');
    }
    return null;
  }

  parseQuote(data, symbol) {
    const strike = this.extractStrike(symbol);
    const optionType = symbol.endsWith('CE') ? 'CE' : 'PE';
    return {
      symbol: symbol,
      strike: strike,
      option_type: optionType,
      ltp: parseFloat(data.lp || data.LTP || 0),
      bid: parseFloat(data.bp || data.bid || 0),
      ask: parseFloat(data.sp || data.ask || 0),
      open_interest: parseInt(data.oi || data.OI || 0, 10),
      volume: parseInt(data.v || data.Volume || 0, 10),
      iv: parseFloat(data.iv || data.IV || 0),
    };
  }

  extractStrike(symbol) {
    const match = symbol.match(/(\d+)(CE|PE)$/);
    return match ? parseInt(match[1], 10) : 0;
  }

  async publishSnapshot(snapshot) {
    if (this.kafkaProducer && this.kafkaTopic) {
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
  }

  getStats() {
    return { ...this.stats };
  }
}

module.exports = { OptionChainPoller };
