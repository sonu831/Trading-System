/**
 * StrikeSelector — resolves strike price to NFO trading symbol.
 */
const { nextWeeklyExpiry } = require('./utils/time');
const logger = require('./utils/logger');

interface Signal { direction: string; optionType?: string; params?: { moneyness?: string; [k: string]: unknown }; }
interface StrikeCache { spot?: number; updatedAt?: number; [k: string]: unknown; }
interface Instrument { underlying: string; strikeStep: number; expiryWeekday: number; expiryRollAfter?: string; lotSize: number; maxSpreadPct?: number; minOpenInterest?: number; }
interface ResolvedInstrument { nfoSymbol: string; strike: number; expiry: string; optionType: string; moneyness?: string; lotSize: number; }

class StrikeSelector {
  config: Record<string, any>;
  strikeStep: number; expiryWeekday: number; expiryRollAfter?: string;
  maxSpreadPct: number; minOpenInterest: number;
  instrument: Instrument;

  constructor(config: any) {
    this.config = config; this.instrument = config.instrument;
    this.strikeStep = config.instrument.strikeStep; this.expiryWeekday = config.instrument.expiryWeekday;
    this.expiryRollAfter = config.instrument.expiryRollAfter;
    this.maxSpreadPct = config.strike?.maxSpreadPct ?? 0.1; this.minOpenInterest = config.strike?.minOpenInterest ?? 100000;
  }

  resolve(signal: Signal, spotPrice: number, _cache?: StrikeCache | null): ResolvedInstrument | null {
    if (!spotPrice || spotPrice <= 0) { logger.warn('StrikeSelector: no spot'); return null; }
    const atm = Math.round(spotPrice / this.strikeStep) * this.strikeStep;
    const moneyness = (signal.params?.moneyness || this.config.strike?.moneyness || 'ATM') as string;
    const strike = moneyness === 'ITM1' ? (signal.direction === 'LONG' ? atm - this.strikeStep : atm + this.strikeStep) : atm;
    const expiry = nextWeeklyExpiry(this.expiryWeekday, this.expiryRollAfter);
    const nfoSymbol = this.nfoSymbol(this.instrument.underlying, expiry, strike, signal.optionType || 'CE');
    return { nfoSymbol, strike, expiry, optionType: signal.optionType || 'CE', moneyness, lotSize: this.instrument.lotSize };
  }

  nfoSymbol(underlying: string, expiry: string, strike: number, optionType: string): string {
    const m = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const d = new Date(expiry + 'T00:00:00+05:30');
    const yy = String(d.getUTCFullYear()).slice(2); const mm = m[d.getUTCMonth()]; const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${underlying}${dd}${mm}${yy}${strike}${optionType}`;
  }
}

export = { StrikeSelector };
