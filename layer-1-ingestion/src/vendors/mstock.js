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
        this.ticker.disconnect(); // Correct method name for SDK 0.0.2
      }
      await this.startWebSocket();
      logger.info('MStockVendor: Connected via SDK.');
    } catch (error) {
      logger.error(`MStockVendor connection failed: ${error.message}`);
      // Do not throw, allow retry logic to happen if implemented or just fail gracefully
      // But for initial connect, we might want to propagate to Composite
    }
  }

  async authenticate() {
    // If access token is provided manually, set it
    if (this.accessToken) {
      this.client.setAccessToken(this.accessToken);
      logger.info('MStockVendor: Using provided Access Token.');
      return;
    }

    // Auto-login (2-Step Process: Login -> VerifyTOTP)
    if (this.clientCode && this.password && this.totpSecret) {
      logger.info(`MStockVendor: Step 1 - Login for ${this.clientCode}`);

      try {
        // Step 1: Login with empty TOTP
        const loginResponse = await this.client.login({
          clientcode: this.clientCode,
          password: this.password,
          totp: '', // Must be empty
          state: '',
        });

        logger.info(`MStockVendor: Step 1 Response: ${JSON.stringify(loginResponse)}`);

        if (!loginResponse || !loginResponse.data) {
          throw new Error(`Step 1 Login failed: ${JSON.stringify(loginResponse)}`);
        }

        // CRITICAL CHANGE: Even if Step 1 says "Login Success" and gives a token,
        // we MUST check if we have a TOTP Secret configured.
        // If we do, we MUST proceed to Step 2 (VerifyTOTP) to upgrade to a Trading Token.
        // The "Login Only" token (Step 1) causes 502 on WebSocket.

        const msg = (loginResponse.message || '').toLowerCase();
        const hasSecret = !!this.totpSecret;

        // Only exit early if we DO NOT have a secret AND the response implies success.
        if (loginResponse.data.jwtToken && !msg.includes('otp') && !hasSecret) {
          logger.info('MStockVendor: Login complete at Step 1 (No TOTP Secret configured).');
          this.accessToken = loginResponse.data.jwtToken;
          this.client.setAccessToken(this.accessToken);
          return;
        }

        logger.info(
          'MStockVendor: Step 1 Complete. Proceeding to TOTP Verification (Required for Trading Token)...'
        );

        const refreshToken = loginResponse.data.refreshToken;
        if (!refreshToken) {
          logger.warn(
            'MStockVendor: No Refresh Token found in Step 1 response. Cannot verify TOTP.'
          );
          // Fallback to JWT if available, though it might fail WS
          if (loginResponse.data.jwtToken) {
            logger.warn('MStockVendor: Using partial JWT as fall back.');
            this.accessToken = loginResponse.data.jwtToken;
            this.client.setAccessToken(this.accessToken);
            return;
          }
          throw new Error('Step 1 failed: No Refresh Token and No JWT.');
        }

        // Step 2: Generate TOTP
        const totp = new OTPAuth.TOTP({
          secret: OTPAuth.Secret.fromBase32(this.totpSecret),
          algorithm: 'SHA1',
          digits: 6,
          period: 30,
        });
        const totpCode = totp.generate();

        // Step 3: Verify TOTP to get Access Token
        try {
          const totpResponse = await this.client.verifyTOTP(refreshToken, totpCode);
          if (totpResponse && totpResponse.data && totpResponse.data.jwtToken) {
            this.accessToken = totpResponse.data.jwtToken;
            this.client.setAccessToken(this.accessToken);
            logger.info('MStockVendor: Step 2 Success. Access Token retrieved.');
          } else {
            throw new Error(`Step 2 VerifyTOTP failed: ${JSON.stringify(totpResponse)}`);
          }
        } catch (verErr) {
          logger.error(`MStockVendor: VerifyTOTP Error Details: ${verErr.message}`);

          // If TOTP is not enabled, use the token from Step 1 if available
          if (verErr.message && verErr.message.toLowerCase().includes('totp')) {
            logger.warn(
              'MStockVendor: TOTP Error (Disabled/Invalid). Attempting fallback to Step 1 Token.'
            );
            if (loginResponse.data.jwtToken) {
              this.accessToken = loginResponse.data.jwtToken;
              this.client.setAccessToken(this.accessToken);
            } else {
              throw new Error('TOTP failed and no Step 1 Token available.');
            }
          } else {
            throw verErr; // Re-throw other errors
          }
        }

        // UNWRAP TOKEN LOGIC:
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
              // logger.info(`MStockVendor: Token Payload: ${payloadStr.substring(0, 100)}...`);

              const payload = JSON.parse(payloadStr);

              if (payload.ACCESS_TOKEN) {
                logger.info(
                  `MStockVendor: ✅ Found inner ACCESS_TOKEN. Length: ${payload.ACCESS_TOKEN.length}. Replacing outer token.`
                );
                this.accessToken = payload.ACCESS_TOKEN;
                this.client.setAccessToken(this.accessToken);
              } else {
                logger.warn('MStockVendor: Inner ACCESS_TOKEN not found in payload.');
                // Log keys to debug
                logger.warn(`Payload Keys: ${Object.keys(payload).join(', ')}`);
              }
            }
          } catch (parseErr) {
            logger.warn(
              `MStockVendor: Failed to parse Access Token for unwrapping: ${parseErr.message}`
            );
          }
        }
      } catch (error) {
        logger.error(`MStock Authentication Failed: ${error.message}`);
        // If it's the "Invalid character 1" likely user input error, re-throw to log
        throw error;
      }
    } else {
      throw new Error(
        'MStock: Missing credentials (API Key + AccessToken OR ClientCode/Pass/Secret)'
      );
    }
  }

  async startWebSocket() {
    if (!this.accessToken) return;

    logger.info(
      `MStockVendor: Starting WebSocket (MTicker)... APIKey Len: ${this.apiKey.length}, Token Len: ${this.accessToken.length}`
    );
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
        // Log for debug (optional, maybe too verbose)
        // logger.debug(`Tick: ${JSON.stringify(tick)}`);

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

  async getQuotes() {
    // Use SDK getQuote
    // const quotes = await client.getQuote({...})
    // Implementation omitted/simplified as we rely on WebSocket now
    // calling getQuote manually is possible if needed
    return [];
  }

  async getHistoricalData(symbol, interval, from, to) {
    if (!this.client) return [];

    const parts = symbol.split(':');
    const exchange = parts.length === 2 ? parts[0] : 'NSE';
    const token = parts.length === 2 ? parts[1] : symbol;

    // SDK expects specific interval strings usually. Assuming input matches or mapping needed.
    // e.g. 'ONE_MINUTE'
    try {
      const data = await this.client.getHistoricalData({
        exchange,
        symboltoken: token,
        interval: interval, // TODO: Map '1m' to 'ONE_MINUTE' if SDK strictly requires enums
        fromdate: from,
        todate: to,
      });
      // Map data...
      return data;
    } catch (e) {
      logger.error(`MStock Hist Data Error: ${e.message}`);
      return [];
    }
  }

  isConnected() {
    return this.connected;
  }

  async disconnect() {
    if (this.ticker) {
      this.ticker.close();
    }
    this.connected = false;
    logger.info('MStockVendor SDK Disconnected.');
  }
}

module.exports = { MStockVendor };
