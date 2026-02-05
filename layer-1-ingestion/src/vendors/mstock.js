const { BaseVendor } = require('./base');
const { MStockMapper } = require('../mappers/mstock');
const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');
const OTPAuth = require('otpauth');
const { MConnect, MTicker } = require('@mstock-mirae-asset/nodetradingapi-typeb');

// =================================================================
// GLOBAL HACK: Monkey-patch console.error & console.log to silence SDK noise
// =================================================================
const util = require('util');

if (!global.isConsolePatched) {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  console.error = (...args) => {
    // robustly detecting the error string using util.format (mimics console output)
    const msg = util.format(...args);
    if (
      msg.includes('Unexpected server response: 502') ||
      msg.includes('Max reconnection attempts reached') ||
      msg.includes('WebSocket was closed before the connection was established')
    ) {
      // Silently suppress massive SDK error logs
      return;
    }
    originalConsoleError.apply(console, args);
  };

  console.log = (...args) => {
    const msg = util.format(...args);
    if (msg.includes('WebSocket connection closed')) {
       // Suppress SDK's generic close message (we log our own context-aware one)
       return;
    }
    originalConsoleLog.apply(console, args);
  };

  global.isConsolePatched = true;
}

class MStockVendor extends BaseVendor {
  constructor(options = {}) {
    super(options);
    this.name = 'mstock';
    // Debug helper: Random Instance ID
    this.instanceId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');

    // Auth credentials
    this.apiKey = process.env.MSTOCK_API_KEY ? process.env.MSTOCK_API_KEY.trim() : '';
    this.clientCode = process.env.MSTOCK_CLIENT_CODE ? process.env.MSTOCK_CLIENT_CODE.trim() : '';
    this.password = process.env.MSTOCK_PASSWORD ? process.env.MSTOCK_PASSWORD.trim() : '';
    this.totpSecret = process.env.MSTOCK_TOTP_SECRET ? process.env.MSTOCK_TOTP_SECRET.trim() : '';

    this.accessToken = process.env.MSTOCK_ACCESS_TOKEN
      ? process.env.MSTOCK_ACCESS_TOKEN.trim()
      : '';

    if (!this.apiKey) {
      logger.warn(`[${this.instanceId}] MSTOCK_API_KEY not set. MStock SDK will fail.`);
    }

    this.mapper = new MStockMapper();
    this.subscribedSymbols = options.symbols || [];
    this.client = new MConnect('https://api.mstock.trade', this.apiKey);
    this.ticker = null;
    this.connected = false;
    this.intentionalDisconnect = false;
  }

  async connect() {
    this.intentionalDisconnect = false;
    try {
      logger.info(`[${this.instanceId}] MStockVendor: Connecting...`);
      await this.authenticate();
      if (this.ticker) {
        logger.info(`[${this.instanceId}] MStockVendor: Disconnecting MTicker...`);
        this.ticker.disconnect();
      }
      await this.startWebSocket();
      logger.info(`[${this.instanceId}] MStockVendor: Connected via SDK.`);
    } catch (error) {
      logger.error(`[${this.instanceId}] MStockVendor connection failed: ${error.message}`);
    }
  }

  async authenticate(force = false) {
    // If access token is provided manually, set it
    // Unless we are forcing a new login (Re-auth)
    if (this.accessToken && !force) {
      this.client.setAccessToken(this.accessToken);
      logger.info('MStockVendor: Using provided Access Token.');
      // Fall through to unwrapping logic.
    } else if (this.clientCode && this.password && this.totpSecret) {
      // =================================================================
      // VERIFIED 2-STEP AUTHENTICATION FLOW
      // =================================================================
      logger.info(
        `MStockVendor: Starting 2-Step Authentication for ${this.clientCode} (Force: ${force})`
      );

      try {
        // Step 1: Login (Empty TOTP)
        logger.info(`MStockVendor: Step 1 - Initial Login (Empty TOTP)`);
        const loginResponse = await this.client.login({
          clientcode: this.clientCode,
          password: this.password,
          totp: '', // Must be empty for step 1
          state: 'live',
        });

        if (!loginResponse || !loginResponse.data || !loginResponse.data.jwtToken) {
          throw new Error(`Step 1 Login failed: ${JSON.stringify(loginResponse)}`);
        }

        const tempToken = loginResponse.data.jwtToken;
        logger.info('MStockVendor: Step 1 Success. Got Login Token.');

        // Step 2: Verify TOTP
        logger.info(`MStockVendor: Step 2 - Verifying TOTP...`);

        // Generate TOTP Code
        const totpGen = new OTPAuth.TOTP({
          secret: OTPAuth.Secret.fromBase32(this.totpSecret),
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });
        const code = totpGen.generate();
        logger.info(`MStockVendor: Generated TOTP Code: ${code}`);

        const totpResponse = await this.client.verifyTOTP(tempToken, code);

        if (!totpResponse || !totpResponse.data || !totpResponse.data.jwtToken) {
          throw new Error(`Step 2 VerifyTOTP failed: ${JSON.stringify(totpResponse)}`);
        }

        // Use the FINAL Trading Token
        logger.info('MStockVendor: Step 2 Success. Got Trading Token.');
        this.accessToken = totpResponse.data.jwtToken;
        this.client.setAccessToken(this.accessToken);
      } catch (error) {
        logger.error(`MStock Authentication Failed: ${error.message}`);
        throw error;
      }
    } else {
      throw new Error(
        'MStock: Missing credentials (API Key + AccessToken OR ClientCode/Pass/Secret). Cannot Authenticate.'
      );
    }

    // UNWRAP TOKEN LOGIC (Shared):
    // Check if the token (Manual or Auto-generated) is a wrapper token containing ACCESS_TOKEN
    if (this.accessToken) {
      try {
        const parts = this.accessToken.split('.');
        logger.info(`MStockVendor: Token Parts Length: ${parts.length}`);

        if (parts.length === 3) {
          // Fix Base64Url to Base64
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          // Add padding
          const pad = base64.length % 4;
          if (pad) {
            base64 += new Array(5 - pad).join('=');
          }

          const payloadStr = Buffer.from(base64, 'base64').toString();
          // logger.info(`MStockVendor: Token Payload: ${payloadStr.substring(0, 50)}...`);

          const payload = JSON.parse(payloadStr);

          if (payload.ACCESS_TOKEN) {
            logger.info(
              `MStockVendor: ✅ Found inner ACCESS_TOKEN. Length: ${payload.ACCESS_TOKEN.length}.`
            );
            // DO NOT overwrite the main accessToken used for HTTP Client, as it breaks the API (401).
            // The outer 'Trading Token' is required for MConnect HTTP calls.
            // this.accessToken = payload.ACCESS_TOKEN;
            // this.client.setAccessToken(this.accessToken);

            // Store it separately if ever needed for WS (though WS likely takes the outer one too or is broken externally)
            this.wsAccessToken = payload.ACCESS_TOKEN;
          } else {
            // It might be already unwrapped or a different token type
            if (this.totpSecret && !this.accessToken.startsWith('ey')) {
              // heuristic? No, just log warning if expected structure missing
              logger.warn(
                'MStockVendor: Inner ACCESS_TOKEN not found in payload (Typical for Login Tokens, not Trading Tokens).'
              );
            }
          }
        }
      } catch (parseErr) {
        logger.warn(
          `MStockVendor: Failed to parse Access Token for unwrapping: ${parseErr.message}`
        );
      }
    }
  }

  async startWebSocket() {
    if (!this.accessToken) return;
    if (process.env.SKIP_WEBSOCKET === 'true') {
      logger.info('MStockVendor: SKIP_WEBSOCKET=true. Skipping WebSocket connection.');
      return;
    }

    logger.info(
      `MStockVendor: Starting WebSocket (MTicker)... APIKey Len: ${this.apiKey.length}, Token Len: ${this.accessToken.length}`
    );

    // USER REQUEST: Skip WebSocket if Market is Closed to avoid 502 Errors
    const marketStatus = this.marketHours.getMarketStatus();
    if (!marketStatus.isOpen) {
      logger.info('MStockVendor: Market Closed (or Weekend). Skipping WebSocket connection.');
      return;
    }

    // Check for illegal characters
    if (this.apiKey.includes('#')) logger.warn("⚠️ API Key contains '#'");
    if (this.accessToken.includes('#')) logger.warn("⚠️ Access Token contains '#'");

    try {
      // ERROR FIX: SDK does not URL-encode parameters, which breaks keys with '+' or '='
      // We must encode them here so the constructed URL is valid.
      const encodedApiKey = encodeURIComponent(this.apiKey);
      const encodedToken = encodeURIComponent(this.accessToken);

      logger.info(
        `MStockVendor: Init MTicker with Encoded API Key (${encodedApiKey.length} chars)`
      );

      this.ticker = new MTicker({
        api_key: encodedApiKey,
        access_token: encodedToken,
        maxReconnectionAttempts: 0, // Disable SDK internal retries; we handle it manually
        reconnectDelay: 2000,
      });

      // Prevent unhandled error dumps from the underlying socket if possible
      if (this.ticker.client) {
        this.ticker.client.on('error', (err) => {
           logger.debug(`[${this.instanceId}] Suppressed underlying WS error: ${err.message}`);
        });
      }

      // Event: Connected
      this.ticker.onConnect = () => {
        logger.info('✅ MStock MTicker: Connected');
        this.connected = true;
        this.ticker.sendLoginAfterConnect();

        // Subscribe to existing symbols
        if (this.subscribedSymbols.length > 0) {
          this.subscribeToTicker(this.subscribedSymbols);
        }
      };

      // Event: Tick Received
      this.ticker.onBroadcastReceived = (tick) => {
        // Track raw packet metrics
        metrics.websocketPackets.inc({ vendor: 'mstock' });
        const byteSize = tick ? JSON.stringify(tick).length : 0;
        metrics.websocketDataBytes.inc({ vendor: 'mstock' }, byteSize);

        const normalized = this.mapper.map(tick);
        if (normalized && this.onTick) {
          this.onTick(normalized);
        }
      };

      // Event: Error
      this.ticker.onError = (err) => {
        let msg = '';
        if (err instanceof Error) {
          msg = err.message;
        } else if (typeof err === 'object') {
          // Handle ErrorEvent or other objects that JSON.stringify might miss
          msg = err.message || err.type || JSON.stringify(err);
        } else {
          msg = String(err);
        }
        
        // Special handling for 502 errors - server unavailable
        if (msg.includes('502') || msg.includes('503') || msg.includes('Bad Gateway')) {
          const retryDelay = Math.min(30000, (this.reconnectAttempts || 0) * 5000 + 5000);
          metrics.websocketConnections.set({ vendor: 'mstock', status: 'error' }, 1);
          
          if (!this.intentionalDisconnect && !this.isReconnecting) {
            logger.warn(`[${this.instanceId}] ⚠️ WebSocket 502/503 Error - Server unavailable. Retrying in ${retryDelay/1000}s...`);
            this.isReconnecting = true;
            this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
            setTimeout(() => this.reconnect(), retryDelay);
          } else {
             logger.debug(`[${this.instanceId}] ⚠️ Additional 502 Error received (suppressed).`);
          }
          return; // Don't log as error, just retry
        }
        
        logger.error(`[${this.instanceId}] ❌ MStock MTicker Error: ${msg}`);
      };

      // Event: Close
      this.ticker.onClose = () => {
        this.connected = false;
        metrics.websocketConnections.set({ vendor: 'mstock', status: 'disconnected' }, 1);

        if (!this.intentionalDisconnect && !this.isReconnecting) {
          logger.warn(`[${this.instanceId}] ⚠️ MStock MTicker Closed. Reconnecting...`);
          const retryDelay = Math.min(60000, (this.reconnectAttempts || 0) * 5000 + 5000);
          this.isReconnecting = true;
          this.reconnectAttempts = (this.reconnectAttempts || 0) + 1;
          setTimeout(() => this.reconnect(), retryDelay);
        } else if (this.isReconnecting) {
             logger.debug(`[${this.instanceId}] ⚠️ MStock MTicker Closed (Reconnection in progress).`);
        }
      };

      this.ticker.connect();
    } catch (err) {
      logger.error(`Failed to init MTicker: ${err.message}`);
      // Retry init if it failed synchronously
      if (!this.intentionalDisconnect && !this.isReconnecting) {
        this.isReconnecting = true;
        setTimeout(() => this.reconnect(), 10000); // Use reconnect() to ensure auth is fresh
      }
    }
  }

  async reconnect() {
    if (this.intentionalDisconnect) return;

    try {
      logger.info('🔄 MStockVendor: Reconnecting (Step 1: Cleanup)...');
      // Ensure previous ticker is dead
      if (this.ticker) {
        try {
          this.ticker.onClose = () => {};
          this.ticker.onError = () => {};
          this.ticker.onConnect = () => {};
          this.ticker.disconnect();
        } catch (e) {
          /* ignore */
        }
        this.ticker = null;
      }

      logger.info('🔄 MStockVendor: Reconnecting (Step 2: Re-Auth)...');
      // Force Re-Authentication (Generation of new Token)
      await this.authenticate(true);

      if (this.accessToken) {
        logger.info('🔄 MStockVendor: Reconnecting (Step 3: Start WS)...');
        await this.startWebSocket();
      } else {
        throw new Error('Re-Auth failed to produce valid token');
      }
    } catch (err) {
      logger.error(`❌ Reconnection Failed: ${err.message}. Retrying in 10s...`);
      setTimeout(() => this.reconnect(), 10000);
    } finally {
      this.isReconnecting = false;
    }
  }

  // Helper to align internal subscribe logic with SDK methods
  subscribeToTicker(symbols) {
    // SDK expects number[] for tokens.
    // Our symbols are "NSE:123" or "123".
    const tokens = [];

    symbols.forEach((s) => {
      let tokenStr = s;
      if (s.includes(':')) {
        tokenStr = s.split(':')[1];
      }
      const tokenNum = parseInt(tokenStr, 10);
      if (!isNaN(tokenNum)) {
        tokens.push(tokenNum);
      }
    });

    if (tokens.length > 0) {
      // SDK subscribe takes number[]
      this.ticker.subscribe(tokens);
      logger.info(`MStock SDK Subscribed: ${tokens.length} tokens`);
    }
  }

  isConnected() {
    return this.connected;
  }

  async disconnect() {
    this.intentionalDisconnect = true;
    if (this.ticker) {
      try {
        // Prevent zombie callbacks triggering after we requested disconnect
        // Use empty no-op functions instead of null to prevent "is not a function" crashes in SDK
        this.ticker.onClose = () => {};
        this.ticker.onError = () => {};
        this.ticker.onConnect = () => {};
        this.ticker.disconnect();
      } catch (e) {
        logger.debug(`[${this.instanceId}] Suppressed disconnect error: ${e.message}`);
      }
    }
    // Restore console.error if we patched it (in case we didn't via callbacks)
    // Note: The variable originalConsoleError isn't in scope here unless we move it up,
    // but the closure in startWebSocket handles it for that instance. 
    // Ideally we should handle this cleaner, but for now relying on the instance lifecycle.
    this.connected = false;
    logger.info(`[${this.instanceId}] MStockVendor SDK Disconnected.`);
  }

  // --- Helper Methods using HTTP Client (if needed) ---
  // --- Helper Methods using HTTP Client ---
  async getHistoricalData(params, retryCount = 0) {
    if (!this.client) return { status: false, message: 'Client not initialized' };
    const { ResponseBuilder } = require('../utils/response-builder');
    const { metrics } = require('../utils/metrics');

    const startTime = Date.now();
    const endpoint = 'getHistoricalData';

    try {
      // Normalize Params (BaseVendor handles this, but safety check)
      const response = await this.client.getHistoricalData(params);

      // Track metrics
      const latency = (Date.now() - startTime) / 1000;
      metrics.externalApiLatency.observe({ vendor: 'mstock', endpoint }, latency);

      if (response && response.status === true) {
        metrics.externalApiCalls.inc({ vendor: 'mstock', endpoint, status: 'success' });
        return ResponseBuilder.success(response.data);
      } else {
        metrics.externalApiCalls.inc({ vendor: 'mstock', endpoint, status: 'error' });
        // Check for 401 / Invalid Request in partial failure
        if (
          (response.message && response.message.includes('401')) ||
          (response.message && response.message.includes('Invalid request'))
        ) {
          throw new Error('401_AUTH_ERROR');
        }
        return ResponseBuilder.error(
          response.message || 'MStock API Error',
          response.errorcode,
          response
        );
      }
    } catch (e) {
      // Track failed API call
      const latency = (Date.now() - startTime) / 1000;
      metrics.externalApiLatency.observe({ vendor: 'mstock', endpoint }, latency);
      metrics.externalApiCalls.inc({ vendor: 'mstock', endpoint, status: 'error' });

      // Auto-Recover from 401
      if (
        (e.message === '401_AUTH_ERROR' ||
          e.message.includes('401') ||
          e.message.includes('Invalid request')) &&
        retryCount < 1
      ) {
        logger.warn(`MStockVendor: 401 Auth Error (Retry ${retryCount + 1}). Re-authenticating...`);
        try {
          // FORCE new login
          await this.authenticate(true);
          return await this.getHistoricalData(params, retryCount + 1);
        } catch (authErr) {
          logger.error(`MStockVendor: Re-auth failed: ${authErr.message}`);
          return ResponseBuilder.error('Re-auth Failed', 'AUTH_FAIL');
        }
      }

      logger.error(`MStock Hist Data Error: ${e.message}`);
      return ResponseBuilder.error(e.message, 'SDK_ERR');
    }
  }
}

module.exports = { MStockVendor };
