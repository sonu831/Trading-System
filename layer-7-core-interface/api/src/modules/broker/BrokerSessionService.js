const MSTOCK_API_BASE = 'https://api.mstock.trade';

let MConnect = null;
let OTPAuth = null;

function loadMStockSDK() {
  if (!MConnect) {
    ({ MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb'));
  }
  if (!OTPAuth) {
    OTPAuth = require('otpauth');
  }
}

class BrokerSessionService {
  constructor({ brokerService }) {
    this.brokerService = brokerService;
    this.activeClients = new Map();
  }

  async getCredentials(provider) {
    return this.brokerService.getDecryptedCredentials(provider);
  }

  async getCachedToken(provider) {
    return this.brokerService.getSessionToken(provider);
  }

  async saveToken(provider, token, ttlSeconds) {
    return this.brokerService.saveSessionToken(provider, token, ttlSeconds);
  }

  async testConnection(provider) {
    const creds = await this.getCredentials(provider);
    if (!creds) {
      return { success: false, error: `No credentials configured for ${provider}` };
    }

    if (provider === 'mstock') {
      return this.testMStock(creds);
    }

    return { success: false, error: `Provider ${provider} not supported for testing` };
  }

  async testMStock(creds) {
    loadMStockSDK();
    const { api_key, client_code, password, totp_secret } = creds;

    if (!api_key || !client_code || !password || !totp_secret) {
      return {
        success: false,
        error: 'Missing required credentials (api_key, client_code, password, totp_secret required)',
        missing: Object.entries({ api_key, client_code, password, totp_secret })
          .filter(([, v]) => !v)
          .map(([k]) => k),
      };
    }

    const client = new MConnect(MSTOCK_API_BASE, api_key);

    try {
      const loginResp = await client.login({
        clientcode: client_code,
        password: password,
        totp: '',
        state: 'live',
      });

      if (!loginResp?.data?.jwtToken && !loginResp?.data?.token) {
        return { success: false, error: 'Login failed: no token in response', stage: 'login' };
      }

      const loginToken = loginResp.data.jwtToken || loginResp.data.token;

      const totp = new OTPAuth.TOTP({
        issuer: 'MStock',
        label: client_code,
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(totp_secret),
      });

      const totpCode = totp.generate();

      const verifyResp = await client.verifyTOTP(loginToken, totpCode);

      if (!verifyResp?.data?.jwtToken && !verifyResp?.data?.token) {
        return {
          success: false,
          error: 'TOTP verification failed: no token in response',
          stage: 'totp_verify',
        };
      }

      const tradingToken = verifyResp.data.jwtToken || verifyResp.data.token;

      await this.saveToken(provider, tradingToken, 21000);

      return {
        success: true,
        stage: 'connected',
        token_info: { length: tradingToken.length, expires_in: '~6 hours' },
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Unknown error';
      return { success: false, error: errorMsg };
    }
  }

  async getOrRefreshToken(provider) {
    const cached = await this.getCachedToken(provider);
    if (cached) return cached;

    const creds = await this.getCredentials(provider);
    if (!creds) return null;

    if (provider === 'mstock') {
      const result = await this.testMStock(creds);
      if (result.success) {
        return this.getCachedToken(provider);
      }
      console.error(`[BrokerSession] Failed to authenticate ${provider}: ${result.error}`);
      return null;
    }

    return null;
  }

  async invalidateSession(provider) {
    const key = `broker:session:${provider}`;
    await this.brokerService.brokerRepository.redis.publisher.del(key);
  }
}

module.exports = BrokerSessionService;
