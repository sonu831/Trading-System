/**
 * MStock adapter — wraps @mstock-mirae-asset/nodetradingapi-typeb SDK.
 *
 * The strategy owns auth FLOW. This adapter owns TRANSPORT.
 * One wrapper per external system. Adding MStock = register this adapter + done.
 */
import type { BrokerAdapter, LoginParams, LoginResult, VerifyResult, QuoteParams, HistoricalParams, OptionChainParams } from './broker-adapter.interface';

let MConnect: any;

function isOk(body: any): boolean {
  return body?.status === true || body?.status === 'true';
}

function fail(body: any, fb: string): string {
  return body?.message || body?.data?.message || body?.errorcode || fb;
}

export function createMStockAdapter(apiKey: string): BrokerAdapter {
  if (!MConnect) {
    const sdk = require('@mstock-mirae-asset/nodetradingapi-typeb');
    MConnect = sdk.MConnect;
  }

  const client = new MConnect('https://api.mstock.trade', apiKey);
  let accessToken = '';

  function mstockHeaders(): Record<string, string> {
    return { 'X-PrivateKey': apiKey, 'Authorization': `Bearer ${accessToken}`, 'X-Mirae-Version': '1', 'Content-Type': 'application/json' };
  }

  return {
    id: 'mstock',
    client,

    // ── Auth ──

    async login(params: LoginParams): Promise<LoginResult> {
      let body: any;
      try { body = await client.login(params); }
      catch (err: any) { throw new Error(err.message || 'MStock login request failed'); }
      console.log('[mstock-sdk] login OK — token received:', !!body?.data?.jwtToken);
      if (!isOk(body)) throw new Error(fail(body, 'MStock login failed'));
      const token = body?.data?.jwtToken;
      if (!token) throw new Error('MStock login returned no token');
      return { jwtToken: token };
    },

    async verifyTOTP(refreshToken: string, totp: string): Promise<VerifyResult> {
      let body: any;
      try { body = await client.verifyTOTP(refreshToken, totp); }
      catch (err: any) { throw new Error(err.message || 'MStock TOTP verification failed'); }
      if (!isOk(body)) throw new Error(fail(body, 'MStock TOTP verification failed'));
      const token = body?.data?.jwtToken;
      if (!token) throw new Error('MStock TOTP verification returned no trading token');
      return { jwtToken: token };
    },

    async verifyOTP(refreshToken: string, otp: string): Promise<VerifyResult> {
      let body: any;
      try { body = await client.verifyOTP(refreshToken, otp); }
      catch (err: any) { throw new Error(err.message || 'MStock OTP verification failed'); }
      if (!isOk(body)) throw new Error(fail(body, 'MStock OTP verification failed'));
      const token = body?.data?.jwtToken;
      if (!token) throw new Error('MStock OTP verification returned no trading token');
      return { jwtToken: token };
    },

    async logout(token: string): Promise<void> {
      client.setAccessToken(token);
      try { await client.logout(); } catch { /* best effort */ }
    },

    setAccessToken(token: string): void {
      accessToken = token;
      client.setAccessToken(token);
    },

    // ── Market Data ──

    async getQuote(params: QuoteParams): Promise<any> {
      return client.getQuote(params);
    },

    async getHistoricalData(params: HistoricalParams): Promise<any> {
      return client.getHistoricalData(params);
    },

    async getOptionChain(params: OptionChainParams): Promise<any> {
      return client.getOptionChain(params);
    },

    // ── Portfolio ──

    async getPositions(): Promise<any> {
      return client.getPositions();
    },

    async getHoldings(): Promise<any> {
      return client.getHoldings();
    },

    async placeOrder(params: Record<string, unknown>): Promise<any> {
      return client.placeOrder(params);
    },
  };
}
