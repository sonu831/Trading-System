function cdf(x) {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function blackScholes(S, K, T, r, sigma, type) {
  if (T <= 0) return Math.max(0, type === 'CE' ? S - K : K - S);
  if (sigma <= 0) return Math.max(0, type === 'CE' ? S - K : K - S);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  if (type === 'CE') return S * cdf(d1) - K * Math.exp(-r * T) * cdf(d2);
  return K * Math.exp(-r * T) * cdf(-d2) - S * cdf(-d1);
}

function optionDelta(S, K, T, r, sigma, type) {
  if (T <= 0) return type === 'CE' ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  if (type === 'CE') return cdf(d1);
  return cdf(d1) - 1;
}

class OptionSimulator {
  constructor(options = {}) {
    this.riskFreeRate = options.riskFreeRate || 0.07;
    this.ivBaseline = options.ivBaseline || 0.15;
    this.slippagePct = options.slippagePct || 0.003;
    this.ivCrushPct = options.ivCrushPct || 0.1;
  }

  simulateTrade(signal, spotData) {
    const { direction, optionType, params } = signal;
    const entry = spotData.entry;
    const exit = spotData.exit;

    const spotEntry = entry.price;
    const spotExit = exit.price;

    const dte = this.daysToExpiry(entry.time, spotData.expiry);
    const T = dte / 365;
    const strike = this.selectStrike(spotEntry, optionType);
    const K = strike;

    const entrySigma = this.ivBaseline * (1 + this.ivCrushPct);
    const entryPremium = blackScholes(spotEntry, K, T, this.riskFreeRate, entrySigma, optionType);
    const entryDelta = optionDelta(spotEntry, K, T, this.riskFreeRate, entrySigma, optionType);

    const exitT = Math.max(0, (dte - this.hoursHeld(entry.time, exit.time)) / 365);
    const exitSigma = this.ivBaseline;
    const exitPremium = blackScholes(spotExit, K, exitT, this.riskFreeRate, exitSigma, optionType);

    const entryCost = entryPremium * (1 + this.slippagePct);
    const exitValue = exitPremium * (1 - this.slippagePct);
    const pnl = (exitValue - entryCost) * signal.lots;

    const maxLoss = entryCost * signal.lots;
    const pnlPct = maxLoss > 0 ? (pnl / maxLoss) * 100 : 0;

    return {
      signal,
      strike: K,
      optionType,
      entryPremium: Math.round(entryPremium * 100) / 100,
      exitPremium: Math.round(exitPremium * 100) / 100,
      entryDelta: Math.round(entryDelta * 100) / 100,
      slippage: Math.round(entryPremium * this.slippagePct * 200) / 100,
      entryCost: Math.round(entryCost * 100) / 100,
      exitValue: Math.round(exitValue * 100) / 100,
      pnl: Math.round(pnl * 100) / 100,
      pnlPct: Math.round(pnlPct * 100) / 100,
      spotEntry: Math.round(spotEntry * 100) / 100,
      spotExit: Math.round(spotExit * 100) / 100,
      spotChangePct: Math.round(((spotExit - spotEntry) / spotEntry) * 10000) / 100,
      dte,
      hoursHeld: this.hoursHeld(entry.time, exit.time),
    };
  }

  selectStrike(spot, type) {
    const strikeStep = spot > 20000 ? 100 : 50;
    const atm = Math.round(spot / strikeStep) * strikeStep;
    if (type === 'CE') return atm;
    return atm;
  }

  daysToExpiry(fromTime, expiryStr) {
    const from = new Date(fromTime);
    const expiry = new Date(expiryStr);
    return Math.max(1, Math.round((expiry - from) / 86400000));
  }

  hoursHeld(entryTime, exitTime) {
    return (new Date(exitTime) - new Date(entryTime)) / 3600000;
  }
}

module.exports = { OptionSimulator, blackScholes, cdf };
