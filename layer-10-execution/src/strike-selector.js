const { nextWeeklyExpiry } = require('./utils/time');
const logger = require('./utils/logger');

class StrikeSelector {
  constructor(config) {
    this.config = config;
    this.strikeStep = config.instrument.strikeStep;
    this.expiryWeekday = config.instrument.expiryWeekday;
    this.expiryRollAfter = config.instrument.expiryRollAfter;
    this.maxSpreadPct = config.strike.maxSpreadPct;
    this.minOpenInterest = config.strike.minOpenInterest;
  }

  resolve(signal, spotPrice) {
    if (!spotPrice || spotPrice <= 0) {
      logger.warn('StrikeSelector: no spot price');
      return null;
    }

    const atm = Math.round(spotPrice / this.strikeStep) * this.strikeStep;
    const moneyness = signal.params?.moneyness || this.config.strike.moneyness || 'ATM';
    const strike = moneyness === 'ITM1'
      ? (signal.direction === 'LONG' ? atm - this.strikeStep : atm + this.strikeStep)
      : atm;

    const expiry = nextWeeklyExpiry(this.expiryWeekday, this.expiryRollAfter);

    const nfoSymbol = this.nfoSymbol(this.config.instrument.underlying, expiry, strike, signal.optionType);

    return {
      nfoSymbol,
      underlying: this.config.instrument.underlying,
      strike,
      expiry,
      optionType: signal.optionType,
      exchange: 'NFO',
      lotSize: this.config.instrument.lotSize,
    };
  }

  nfoSymbol(underlying, expiryDate, strike, optionType) {
    const monthCodes = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const d = new Date(expiryDate);
    const yy = String(d.getFullYear()).slice(2);
    const mm = monthCodes[d.getMonth()];
    const dd = String(d.getDate()).padStart(2, '0');
    const stk = String(strike).padStart(5, '0');
    return `${underlying}${yy}${mm}${dd}${stk}${optionType}`;
  }
}

module.exports = { StrikeSelector };
