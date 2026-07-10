const logger = require('../utils/logger');

/**
 * Option Chain Writer
 * Consumes option chain snapshots from Kafka and:
 * 1. Writes each option quote to options_chain hypertable (idempotent)
 * 2. Computes Put-Call Ratio from live data
 * 3. Publishes PCR + ATM IV to Redis
 */
class OptionChainWriter {
  constructor({ pool, redisClient }) {
    this.pool = pool;
    this.redis = redisClient;
    this.lastSnapshot = null;
  }

  /**
   * Process an option chain snapshot from Kafka
   */
  async processSnapshot(snapshot) {
    try {
      const { time, underlying, spot, expiry, atmStrike, options } = snapshot;
      if (!options || !Array.isArray(options)) return;

      this.lastSnapshot = snapshot;

      // Write each option quote to TimescaleDB (idempotent)
      for (const opt of options) {
        await this.writeOption(time, underlying, expiry, opt);
      }

      // Compute PCR: total PUT OI / total CALL OI
      const pcr = this.computePCR(options);

      // Compute ATM IV
      const atmIV = this.getATMIV(options, atmStrike);

      // Publish to Redis for fast reads
      if (this.redis) {
        await this.publishToRedis(underlying, { spot, expiry, atmStrike, pcr, atmIV, optionCount: options.length });
      }

      logger.info(`OptionChain: ${underlying} | ${options.length} strikes | Spot=${spot} | PCR=${pcr.toFixed(2)} | ATM IV=${atmIV}`);
    } catch (err) {
      logger.error({ err }, 'OptionChainWriter: Failed to process snapshot');
    }
  }

  /**
   * Write a single option quote to TimescaleDB
   */
  async writeOption(time, underlying, expiry, opt) {
    try {
      await this.pool.query(
        `INSERT INTO options_chain (time, symbol, expiry, strike, option_type, ltp, bid, ask, open_interest, volume, iv, delta, gamma, theta, vega)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
         ON CONFLICT (time, symbol, expiry, strike, option_type) DO NOTHING`,
        [
          time,
          `${underlying}-OC`,
          expiry,
          opt.strike,
          opt.option_type,
          opt.ltp || null,
          opt.bid || null,
          opt.ask || null,
          opt.open_interest || 0,
          opt.volume || 0,
          opt.iv || null,
          opt.delta || null,
          opt.gamma || null,
          opt.theta || null,
          opt.vega || null,
        ]
      );
    } catch (err) {
      logger.error({ err, symbol: opt.symbol }, 'OptionChainWriter: Failed to insert option');
    }
  }

  /**
   * Compute Put-Call Ratio from total OI
   */
  computePCR(options) {
    let putOI = 0;
    let callOI = 0;
    for (const opt of options) {
      if (opt.option_type === 'PE') putOI += (opt.open_interest || 0);
      if (opt.option_type === 'CE') callOI += (opt.open_interest || 0);
    }
    return callOI > 0 ? putOI / callOI : 0;
  }

  /**
   * Get ATM IV (average of ATM CE and PE IV)
   */
  getATMIV(options, atmStrike) {
    const atmOptions = options.filter((o) => o.strike === atmStrike);
    const ivs = atmOptions.map((o) => o.iv).filter(Boolean);
    if (ivs.length === 0) return 0;
    return ivs.reduce((a, b) => a + b, 0) / ivs.length;
  }

  /**
   * Publish option analytics to Redis
   */
  async publishToRedis(underlying, data) {
    try {
      const key = `option:${underlying}:latest`;
      await this.redis.set(key, JSON.stringify(data), 'EX', 30);

      // Also publish PCR separately for easy consumption
      await this.redis.set(`pcr:${underlying}`, String(data.pcr), 'EX', 30);

      // Publish ATM IV
      if (data.atmIV > 0) {
        await this.redis.set(`iv:${underlying}`, String(data.atmIV), 'EX', 30);
      }
    } catch (err) {
      // Redis might not be available - non-critical
    }
  }
}

module.exports = { OptionChainWriter };
