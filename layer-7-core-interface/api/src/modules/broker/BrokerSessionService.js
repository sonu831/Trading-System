const MSTOCK_API_BASE = 'https://api.mstock.trade';

let MConnect = null;
let OTPAuth = null;

function loadMStockSDK() {
  if (!MConnect) ({ MConnect } = require('@mstock-mirae-asset/nodetradingapi-typeb'));
  if (!OTPAuth) OTPAuth = require('otpauth');
}

class BrokerSessionService {
  constructor({ brokerService }) {
    this.brokerService = brokerService;
  }

  async getCredentials(provider) { return this.brokerService.getDecryptedCredentials(provider); }
  async getCachedToken(provider) { return this.brokerService.getSessionToken(provider); }
  async saveToken(provider, token, ttlSeconds) { return this.brokerService.saveSessionToken(provider, token, ttlSeconds); }

  async testConnection(provider) {
    const creds = await this.getCredentials(provider);
    if (!creds) return { success: false, error: `No credentials for ${provider}` };
    if (provider === 'mstock') return this.testMStock(creds);
    return { success: false, error: `Provider ${provider} not supported` };
  }

  async testMStock(creds) {
    loadMStockSDK();
    const { api_key, client_code, password } = creds;

    if (!api_key || !client_code || !password) {
      return {
        success: false,
        error: 'Missing required credentials (api_key, client_code, password required)',
        missing: ['api_key', 'client_code', 'password'].filter(k => !creds[k]),
      };
    }

    try {
      const client = new MConnect(MSTOCK_API_BASE, api_key);

      // Step 1: Login. When TOTP is enabled, this returns the trading token directly.
      const loginResp = await client.login({ clientcode: client_code, password, totp: '', state: 'live' });

      if (!loginResp?.data?.jwtToken) {
        return {
          success: false,
          error: 'Login failed: ' + (loginResp?.data?.message || loginResp?.status || loginResp?.message || 'unknown'),
          stage: 'login',
        };
      }

      // TOTP enabled → login returns trading token directly. No verifyTOTP needed.
      if (loginResp.data.is_activate || loginResp.status === true) {
        const token = loginResp.data.jwtToken;
        await this.saveToken('mstock', token, 21000);
        return { success: true, stage: 'connected', token_length: token.length };
      }

      // OTP flow: login returned a temp token, need to verify OTP/TOTP
      return { success: false, error: 'OTP-based login requires manual code entry', stage: 'needs_otp' };

    } catch (err) {
      return { success: false, error: err.response?.data?.message || err.message || 'Unknown error' };
    }
  }

  async getOrRefreshToken(provider) {
    const cached = await this.getCachedToken(provider);
    if (cached) return cached;
    const creds = await this.getCredentials(provider);
    if (!creds) return null;
    if (provider === 'mstock') {
      const result = await this.testMStock(creds);
      return result.success ? this.getCachedToken(provider) : null;
    }
    return null;
  }

  async invalidateSession(provider) {
    await this.brokerService.brokerRepository.redis.publisher.del(`broker:session:${provider}`);
  }
}

module.exports = BrokerSessionService;
