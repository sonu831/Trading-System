const BROKER_BASE_URLS = {
  FLATTRADE: 'https://piconnect.flattrade.in/PiConnectAPI',
  FLATTRADE_WS: 'wss://piconnect.flattrade.in/PiConnectWSAPI',
  MSTOCK: 'https://api.mstock.in',
};

const REDIS_KEYS = {
  LTP: (symbol) => `ltp:${symbol}`,
  MARKET_REGIME_LATEST: 'market-regime:latest',
  MARKET_VIEW: 'market_view',
};

module.exports = { BROKER_BASE_URLS, REDIS_KEYS };
