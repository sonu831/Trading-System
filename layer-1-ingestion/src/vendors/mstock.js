const { BaseVendor } = require('./base');
const { MStockMapper } = require('../mappers/mstock');
const { logger } = require('../utils/logger');
const OTPAuth = require('otpauth');
const { MConnect, MTicker } = require('@mstock-mirae-asset/nodetradingapi-typeb');

class MStockVendor extends BaseVendor {
  constructor(options = {}) {
    super(options);
    this.name = 'mstock';

    // Auth credentials
    this.apiKey = process.env.MSTOCK_API_KEY ? process.env.MSTOCK_API_KEY.trim() : '';
    this.clientCode = process.env.MSTOCK_CLIENT_CODE ? process.env.MSTOCK_CLIENT_CODE.trim() : '';
    this.password = process.env.MSTOCK_PASSWORD ? process.env.MSTOCK_PASSWORD.trim() : '';
    this.totpSecret = process.env.MSTOCK_TOTP_SECRET ? process.env.MSTOCK_TOTP_SECRET.trim() : '';

    this.accessToken = process.env.MSTOCK_ACCESS_TOKEN
      ? process.env.MSTOCK_ACCESS_TOKEN.trim()
      : '';

    if (!this.apiKey) {
      logger.warn('MSTOCK_API_KEY not set. MStock SDK will fail.');
    }

    this.mapper = new MStockMapper();
    this.subscribedSymbols = options.symbols || [];
    this.client = new MConnect('https://api.mstock.trade', this.apiKey);
    this.ticker = null;
    this.connected = false;
  }

  async connect() {
    try {
      await this.authenticate();
      if (this.ticker) {
        logger.info('MStockVendor: Disconnecting MTicker...');
        this.ticker.disconnect();
      }
      await this.startWebSocket();
      logger.info('MStockVendor: Connected via SDK.');
    } catch (error) {
      logger.error(`MStockVendor connection failed: ${error.message}`);
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
        maxReconnectionAttempts: 10,
        reconnectDelay: 2000,
      });

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
      // onBroadcastReceived is called for EACH tick, not an array
      this.ticker.onBroadcastReceived = (tick) => {
        const normalized = this.mapper.map(tick);
        if (normalized && this.onTick) {
          this.onTick(normalized);
        }
      };

      // Event: Error
      this.ticker.onError = (err) => {
        logger.error(`❌ MStock MTicker Error: ${err}`);
      };

      // Event: Close
      this.ticker.onClose = () => {
        logger.warn('⚠️ MStock MTicker Closed');
        this.connected = false;
      };

      this.ticker.connect();
    } catch (err) {
      logger.error(`Failed to init MTicker: ${err.message}`);
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
    if (this.ticker) {
      this.ticker.disconnect();
    }
    this.connected = false;
    logger.info('MStockVendor SDK Disconnected.');
  }

  // --- Helper Methods using HTTP Client (if needed) ---
  // --- Helper Methods using HTTP Client ---
  async getHistoricalData(params, retryCount = 0) {
    if (!this.client) return { status: false, message: 'Client not initialized' };
    const { ResponseBuilder } = require('../utils/response-builder');

    try {
      // Normalize Params (BaseVendor handles this, but safety check)
      const response = await this.client.getHistoricalData(params);

      if (response && response.status === true) {
        return ResponseBuilder.success(response.data);
      } else {
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
