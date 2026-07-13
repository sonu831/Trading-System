const { BaseVendor } = require('./base');
const { MStockMapper } = require('../mappers/mstock');
const logger = require('../utils/logger');
const { metrics } = require('../utils/metrics');
const { MConnect, MTicker } = require('@mstock-mirae-asset/nodetradingapi-typeb');

// Broker URLs live in shared/constants.js (rule 3/14) — never hardcoded per-layer.
let BROKER_BASE_URLS = null;
try { BROKER_BASE_URLS = require('/app/shared/constants').BROKER_BASE_URLS; } catch (_) {
  try { BROKER_BASE_URLS = require('../../../shared/constants').BROKER_BASE_URLS; } catch (_e) { BROKER_BASE_URLS = null; }
}
if (!BROKER_BASE_URLS?.MSTOCK) {
  throw new Error('shared/constants.js BROKER_BASE_URLS.MSTOCK not resolvable — MStock vendor cannot start');
}

const util = require('util');

const noopLog = new Set([
  'Unexpected server response: 502',
  'Max reconnection attempts reached',
  'WebSocket was closed before the connection was established',
  'WebSocket connection closed',
]);

/** Filter noisy SDK log messages without globally mutating console. */
function filterConsoleLog(logFn, ...args) {
  const msg = util.format(...args);
  for (const pattern of noopLog) { if (msg.includes(pattern)) return; }
  logFn(...args);
}

// Wire SDK's log output through our filtered logger, NOT global console monkey-patch.
const originalConsoleError = console.error.bind(console);
const originalConsoleLog = console.log.bind(console);
console.error = (...args) => filterConsoleLog(originalConsoleError, ...args);
console.log = (...args) => filterConsoleLog(originalConsoleLog, ...args);

class MStockVendor extends BaseVendor {
  constructor(options = {}) {
    super(options);
    this.name = 'mstock';
    this.instanceId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    this.apiKey = (options.apiKey || process.env.MSTOCK_API_KEY || '').trim();
    this.subscribedSymbols = options.symbols || [];

    // Token comes from the centralized BrokerSessionService via CredentialStore (Redis).
    // The vendor NEVER self-authenticates. If there is no token, connect() reports
    // "waiting for session" rather than triggering an OTP nobody asked for.
    this.token = (options.sessionToken || '').trim();

    if (!this.apiKey) {
      logger.warn(`[${this.instanceId}] MSTOCK_API_KEY not set.`);
    }
    if (!this.token) {
      logger.warn(`[${this.instanceId}] No session token — vendor will wait until the dashboard authenticates.`);
    }

    this.mapper = new MStockMapper();
    this.client = this.apiKey ? new MConnect('https://api.mstock.trade', this.apiKey) : null;
    this.ticker = null;
    this.connected = false;
    this.intentionalDisconnect = false;
  }

  /**
   * Consume a token produced by the centralized BrokerSessionService (L7).
   * Called by VendorManager after CredentialStore loads / refreshes tokens.
   * RE-CONNECTS the vendor if it was waiting for a token.
   */
  setAccessToken(token) {
    if (!token) return;
    this.token = token;
    if (this.client) this.client.setAccessToken(token);
    logger.info(`[${this.instanceId}] MStockVendor: token updated`);
    if (!this.connected) {
      logger.info(`[${this.instanceId}] MStockVendor: token received after deferred connect — reconnecting`);
      this.connect();
    }
  }

  /**
   * Connect the WebSocket only. Authentication is handled by L7; the L1 vendor
   * is a passive consumer of the Redis-backed session token.
   *
   * Refuses to start if no token is present — OTP spam is NOT an acceptable fallback.
   */
  async connect() {
    this.intentionalDisconnect = false;

    if (!this.client) {
      logger.error(`[${this.instanceId}] MStockVendor: missing apiKey — cannot connect`);
      return;
    }
    if (!this.token) {
      logger.warn(`[${this.instanceId}] MStockVendor: no session token — waiting for dashboard auth`);
      return;
    }

    try {
      this.client.setAccessToken(this.token);
      if (this.ticker) this.ticker.disconnect();
      await this.startWebSocket();
      logger.info(`[${this.instanceId}] MStockVendor: connected`);
    } catch (error) {
      logger.error(`[${this.instanceId}] MStockVendor connection failed: ${error.message}`);
    }
  }

  async startWebSocket() {
    if (!this.token) return;

    if (process.env.SKIP_WEBSOCKET === 'true') {
      logger.info('MStockVendor: SKIP_WEBSOCKET=true. Skipping WebSocket.');
      return;
    }

    const marketStatus = this.marketHours.getMarketStatus();
    if (!marketStatus.isOpen) {
      logger.info('MStockVendor: Market closed — skipping WebSocket.');
      return;
    }

    try {
      const encodedApiKey = encodeURIComponent(this.apiKey);
      const encodedToken = encodeURIComponent(this.token);

      this.ticker = new MTicker({
        api_key: encodedApiKey,
        access_token: encodedToken,
        maxReconnectionAttempts: 0,
        reconnectDelay: 2000,
      });

      if (this.ticker.client) {
        this.ticker.client.on('error', (err) => {
          logger.debug(`[${this.instanceId}] Suppressed WS error: ${err.message}`);
        });
      }

      this.ticker.onConnect = () => {
        logger.info(`[${this.instanceId}] MStock MTicker: connected`);
        this.connected = true;
        this.ticker.sendLoginAfterConnect();
        if (this.subscribedSymbols.length > 0) {
          this.subscribeToTicker(this.subscribedSymbols);
        }
      };

      this.ticker.onBroadcastReceived = (tick) => {
        metrics.websocketPackets.inc({ vendor: 'mstock' });
        const byteSize = tick ? JSON.stringify(tick).length : 0;
        metrics.websocketDataBytes.inc({ vendor: 'mstock' }, byteSize);
        const normalized = this.mapper.map(tick);
        if (normalized && this.onTick) this.onTick(normalized);
      };

      this.ticker.onError = (err) => {
        let msg = '';
        if (err instanceof Error) msg = err.message;
        else if (typeof err === 'object') msg = err.message || err.type || JSON.stringify(err);
        else msg = String(err);

        if (msg.includes('502') || msg.includes('503') || msg.includes('Bad Gateway')) {
          const retryDelay = Math.min(30000, (this.reconnectAttempts || 0) * 5000 + 5000);
          metrics.websocketConnections.set({ vendor: 'mstock', status: 'error' }, 1);
          if (!this.intentionalDisconnect && !this.isReconnecting) {
            logger.warn(`[${this.instanceId}] WS 502/503 — retry in ${retryDelay / 1000}s`);
            this.isReconnecting = true;
            this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
            setTimeout(() => this.reconnectWS(), retryDelay);
          }
          return;
        }
        logger.error(`[${this.instanceId}] MStock MTicker error: ${msg}`);
      };

      this.ticker.onClose = () => {
        this.connected = false;
        metrics.websocketConnections.set({ vendor: 'mstock', status: 'disconnected' }, 1);
        if (!this.intentionalDisconnect && !this.isReconnecting) {
          logger.warn(`[${this.instanceId}] MStock MTicker closed — reconnecting...`);
          const retryDelay = Math.min(60000, (this.reconnectAttempts || 0) * 5000 + 5000);
          this.isReconnecting = true;
          this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
          setTimeout(() => this.reconnectWS(), retryDelay);
        }
      };

      this.ticker.connect();
    } catch (err) {
      logger.error(`[${this.instanceId}] Failed to init MTicker: ${err.message}`);
      if (!this.intentionalDisconnect && !this.isReconnecting) {
        this.isReconnecting = true;
        setTimeout(() => this.reconnectWS(), 10000);
      }
    }
  }

  /**
   * Reconnect the WebSocket only — no re-authentication.
   * The token is alive until L7 refreshes it; if it has expired the
   * CredentialStore will eventually push a new one via setAccessToken().
   */
  async reconnectWS() {
    if (this.intentionalDisconnect) return;
    try {
      logger.info(`[${this.instanceId}] Reconnecting WS...`);
      if (this.ticker) {
        try {
          this.ticker.onClose = () => {};
          this.ticker.onError = () => {};
          this.ticker.onConnect = () => {};
          this.ticker.disconnect();
        } catch (_) {}
        this.ticker = null;
      }
      await this.startWebSocket();
    } catch (err) {
      logger.error(`[${this.instanceId}] WS reconnect failed: ${err.message}. Retrying in 10s...`);
      setTimeout(() => this.reconnectWS(), 10000);
    } finally {
      this.isReconnecting = false;
    }
  }

  subscribeToTicker(symbols) {
    const tokens = [];
    symbols.forEach((s) => {
      let tokenStr = s.includes(':') ? s.split(':')[1] : s;
      const tokenNum = parseInt(tokenStr, 10);
      if (!isNaN(tokenNum)) tokens.push(tokenNum);
    });
    if (tokens.length > 0 && this.ticker) {
      this.ticker.subscribe(tokens);
      logger.info(`[${this.instanceId}] Subscribed: ${tokens.length} tokens`);
    }
  }

  isConnected() {
    return this.connected;
  }

  async disconnect() {
    this.intentionalDisconnect = true;
    if (this.ticker) {
      try {
        this.ticker.onClose = () => {};
        this.ticker.onError = () => {};
        this.ticker.onConnect = () => {};
        this.ticker.disconnect();
      } catch (_) {}
    }
    this.connected = false;
    logger.info(`[${this.instanceId}] MStockVendor disconnected`);
  }

  subscribe(symbols) {
    this.subscribedSymbols = symbols;
    if (this.connected && this.ticker) {
      this.subscribeToTicker(symbols);
    }
  }

  /**
   * Historical candles.
   *
   * We do NOT use the SDK's client.getHistoricalData() here: that call omits the mandatory
   * `X-Mirae-Version: 1` header and MStock answers every request with
   * `401 Invalid request. Please try again.` — which reads like an auth failure and sent us
   * hunting a perfectly valid session token. Issue the request ourselves with the full header
   * set. (The workaround previously existed only in an orphaned batch script.)
   */
  async fetchHistoricalCandles({ symboltoken, interval, fromdate, todate, exchange = 'NSE' }) {
    if (!this.apiKey) return { status: false, message: 'Client not initialized' };
    if (!this.token) return { status: false, message: 'No session token — authenticate via dashboard first' };

    const axios = require('axios');
    const base = BROKER_BASE_URLS.MSTOCK;

    const resp = await axios.post(
      `${base}/openapi/typeb/instruments/historical`,
      { exchange, symboltoken: String(symboltoken), interval, fromdate, todate },
      {
        headers: {
          'X-PrivateKey': this.apiKey,
          Authorization: `Bearer ${this.token}`,
          'X-Mirae-Version': '1', // ← the header the SDK forgets; without it every call is 401
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      },
    );

    const candles = resp.data?.data?.candles;
    if (candles) return { status: true, data: { candles } };
    return { status: false, data: { candles: [] }, message: resp.data?.message || 'no candles' };
  }

  /** Vendor-agnostic entry point used by the batch runner. */
  async fetchData(params) {
    return this.fetchHistoricalCandles(params);
  }

  async getHistoricalData(params, retryCount = 0) {
    if (!this.client) return { status: false, message: 'Client not initialized' };
    if (!this.token) return { status: false, message: 'No session token — authenticate via dashboard first' };

    const { ResponseBuilder } = require('../utils/response-builder');
    const startTime = Date.now();
    const endpoint = 'getHistoricalData';

    try {
      const response = await this.client.getHistoricalData(params);
      const latency = (Date.now() - startTime) / 1000;
      metrics.externalApiLatency.observe({ vendor: 'mstock', endpoint }, latency);

      if (response && response.status === true) {
        metrics.externalApiCalls.inc({ vendor: 'mstock', endpoint, status: 'success' });
        return ResponseBuilder.success(response.data);
      }
      metrics.externalApiCalls.inc({ vendor: 'mstock', endpoint, status: 'error' });
      return ResponseBuilder.error(
        response.message || 'MStock API Error',
        response.errorcode,
        response
      );
    } catch (e) {
      const latency = (Date.now() - startTime) / 1000;
      metrics.externalApiLatency.observe({ vendor: 'mstock', endpoint }, latency);
      metrics.externalApiCalls.inc({ vendor: 'mstock', endpoint, status: 'error' });
      logger.error(`MStock Hist Data Error: ${e.message}`);
      return ResponseBuilder.error(e.message, 'SDK_ERR');
    }
  }
}

module.exports = { MStockVendor };
