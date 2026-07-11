// Mock data shared across the Trading Cockpit UI kit. No network calls — everything here is
// static/randomized client-side so the prototype works standalone.
window.MOCK = (function () {
  function seedSeries(base, n, vol) {
    const out = [base];
    for (let i = 1; i < n; i++) out.push(Math.max(1, out[i - 1] + (Math.random() - 0.5) * vol));
    return out;
  }

  const niftySeries = seedSeries(24800, 60, 18);
  const bankniftySeries = seedSeries(51200, 60, 40);

  const watchlist = [
    { symbol: 'RELIANCE', ltp: 2945.6, chg: 0.82, rsi: 58 },
    { symbol: 'HDFCBANK', ltp: 1687.2, chg: -0.35, rsi: 42 },
    { symbol: 'INFY', ltp: 1789.4, chg: 1.24, rsi: 71 },
    { symbol: 'TCS', ltp: 3854.1, chg: -0.12, rsi: 49 },
    { symbol: 'ICICIBANK', ltp: 1234.8, chg: 0.44, rsi: 55 },
    { symbol: 'SBIN', ltp: 812.3, chg: -1.05, rsi: 33 },
  ];

  const signals = [
    { time: '14:32:08', symbol: 'NIFTY', action: 'BUY', price: 24812, strategy: 'ORB-15', confidence: 0.81 },
    { time: '14:29:41', symbol: 'BANKNIFTY', action: 'SELL', price: 51203, strategy: 'VWAP-Reject', confidence: 0.64 },
    { time: '14:21:03', symbol: 'RELIANCE', action: 'BUY', price: 2941, strategy: 'Momentum', confidence: 0.72 },
  ];

  function chainRows(spot) {
    const atm = Math.round(spot / 50) * 50;
    const strikes = [];
    for (let i = -4; i <= 4; i++) strikes.push(atm + i * 50);
    return strikes.map((strike) => {
      const dist = Math.abs(strike - atm);
      const ceLtp = Math.max(2, 140 - dist * 1.1 + (Math.random() - 0.5) * 4);
      const peLtp = Math.max(2, 40 + dist * 0.9 + (Math.random() - 0.5) * 4);
      return {
        strike,
        isATM: strike === atm,
        ce: { ltp: ceLtp, bid: ceLtp - 0.5, ask: ceLtp + 0.5, oi: 28000 + Math.round(Math.random() * 20000) },
        pe: { ltp: peLtp, bid: peLtp - 0.5, ask: peLtp + 0.5, oi: 25000 + Math.round(Math.random() * 20000) },
      };
    });
  }

  const positions = [
    { id: 1, symbol: 'NIFTY24800CE', optionType: 'CE', strike: 24800, lots: 2, lotSize: 25, entryPrice: 96.4, currentPrice: 128.4, stopLoss: 95, pnl: 1420, pnlPct: 33.2, iv: 14.2, theta: -18.4, delta: 0.52, entryTime: Date.now() - 22 * 60000 },
    { id: 2, symbol: 'NIFTY24700PE', optionType: 'PE', strike: 24700, lots: 1, lotSize: 25, entryPrice: 58.2, currentPrice: 64.1, pnl: -320, pnlPct: -12.8, iv: 15.8, theta: -9.1, delta: -0.31, entryTime: Date.now() - 41 * 60000 },
    { id: 3, symbol: 'BANKNIFTY51200PE', optionType: 'PE', strike: 51200, lots: 1, lotSize: 15, entryPrice: 210.0, currentPrice: 178.5, stopLoss: 260, pnl: 472, pnlPct: 15.0, iv: 16.9, theta: -22.7, delta: -0.44, entryTime: Date.now() - 3 * 3600000 },
  ];

  const brokers = [
    { id: 'flattrade', name: 'Flattrade', status: 'connected', accountId: 'FT10234', mode: 'live' },
    { id: 'mstock', name: 'mStock', status: 'connected', accountId: 'MS88213', mode: 'shadow' },
    { id: 'zerodha', name: 'Zerodha Kite', status: 'disconnected', accountId: null, mode: 'paper' },
  ];

  const backfillSymbols = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'INFY', 'TCS', 'ICICIBANK', 'SBIN'];

  // --- Live tick engine ---------------------------------------------------
  // Mutates the series/watchlist in place every ~1.1s and notifies subscribers,
  // so every screen reading from window.MOCK sees the same moving market
  // instead of a static snapshot. Call window.MOCK.subscribe(fn) in a
  // component's useEffect and setState on each notify to re-render live.
  const listeners = new Set();
  function notify() { listeners.forEach((fn) => fn()); }
  function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    setInterval(() => {
      const step = (arr, vol) => {
        arr.push(Math.max(1, arr[arr.length - 1] + (Math.random() - 0.5) * vol));
        arr.shift();
      };
      step(niftySeries, 12);
      step(bankniftySeries, 28);
      watchlist.forEach((w) => {
        const delta = (Math.random() - 0.5) * (w.ltp * 0.0018);
        w.ltp = Math.max(0.5, w.ltp + delta);
        w.chg = w.chg + delta / w.ltp * 100 * 0.15;
        w.rsi = Math.min(90, Math.max(10, w.rsi + (Math.random() - 0.5) * 3));
      });
      notify();
    }, 1100);
  }

  return { niftySeries, bankniftySeries, watchlist, signals, chainRows, positions, brokers, backfillSymbols, subscribe, start };
})();

// Fire up the tick engine as soon as data.js loads.
window.MOCK.start();

// Shared hook-like helper: components call useLiveTick() to force a re-render
// on every tick without duplicating subscribe/unsubscribe boilerplate.
function useLiveTick() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => window.MOCK.subscribe(() => setTick((t) => t + 1)), []);
}
window.useLiveTick = useLiveTick;

// Shared "current user" context (per-user broker config, as requested).
window.CURRENT_USER = { name: 'Utkarsh', email: 'utkarsh@example.com', accountId: 'AT-4471' };
