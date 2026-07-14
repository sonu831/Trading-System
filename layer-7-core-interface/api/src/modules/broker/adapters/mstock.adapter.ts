/**
 * MStock adapter — raw HTTP wrapper following official API docs.
 * https://tradingapi.mstock.com/docs/v1/typeB/
 *
 * The strategy owns auth FLOW. This adapter owns TRANSPORT.
 * One wrapper per external system.
 */
import type { BrokerAdapter, LoginParams, LoginResult, VerifyResult, QuoteParams, HistoricalParams, OptionChainParams } from './broker-adapter.interface';

const BASE = 'https://api.mstock.trade/openapi/typeb';
const axios = require('axios');

export function createMStockAdapter(apiKey: string): BrokerAdapter {
  let jwtToken = '';
  let feedToken = '';
  let refreshToken = '';

  const hdrs = (includeKey = true): Record<string, string> => {
    const h: Record<string, string> = { 'X-Mirae-Version': '1', 'Content-Type': 'application/json' };
    if (includeKey && apiKey) h['X-PrivateKey'] = apiKey;
    if (jwtToken) h['Authorization'] = `Bearer ${jwtToken}`;
    return h;
  };

  const ok = (body: any) => body?.status === true || body?.status === 'true';
  const err = (body: any, fb: string): string => body?.message || body?.data?.message || body?.errorcode || fb;

  return {
    id: 'mstock',

    get client() { return { setAccessToken: (t: string) => { jwtToken = t; } }; },

    // ── Auth ──

    async login(params: LoginParams): Promise<LoginResult> {
      const resp = await axios.post(`${BASE}/connect/login`, params, { headers: hdrs(false), timeout: 15000 });
      const body = resp.data;
      if (!ok(body)) throw new Error(err(body, 'MStock login failed'));
      const token = body?.data?.jwtToken;
      if (!token) throw new Error('MStock login returned no token');
      if (body?.data?.feedToken) feedToken = body.data.feedToken;
      if (body?.data?.refreshToken) refreshToken = body.data.refreshToken;
      return { jwtToken: token };
    },

    async verifyTOTP(requestToken: string, totp: string): Promise<VerifyResult> {
      const resp = await axios.post(`${BASE}/session/verifytotp`,
        { refreshToken: requestToken, totp },
        { headers: hdrs(true), timeout: 15000 });
      const body = resp.data;
      if (!ok(body)) throw new Error(err(body, 'TOTP verification failed'));
      const token = body?.data?.jwtToken;
      if (!token) throw new Error('TOTP verification returned no trading token');
      jwtToken = token;
      if (body?.data?.feedToken) feedToken = body.data.feedToken;
      if (body?.data?.refreshToken) refreshToken = body.data.refreshToken;
      return { jwtToken: token };
    },

    async verifyOTP(requestToken: string, otp: string): Promise<VerifyResult> {
      const resp = await axios.post(`${BASE}/session/token`,
        { refreshToken: requestToken, otp },
        { headers: hdrs(true), timeout: 15000 });
      const body = resp.data;
      if (!ok(body)) throw new Error(err(body, 'OTP verification failed'));
      jwtToken = body?.data?.jwtToken || '';
      if (body?.data?.feedToken) feedToken = body.data.feedToken;
      if (body?.data?.refreshToken) refreshToken = body.data.refreshToken;
      return { jwtToken: jwtToken };
    },

    async logout(): Promise<void> {
      try { await axios.get(`${BASE}/logout`, { headers: hdrs(true), timeout: 5000 }); } catch { /* best effort */ }
    },

    setAccessToken(token: string): void { jwtToken = token; },

    // ── Market Data ──

    async getQuote(params: QuoteParams): Promise<any> {
      const resp = await axios.post(`${BASE}/instruments/quote`, params, { headers: hdrs(true), timeout: 15000 });
      return resp.data;
    },

    async getHistoricalData(params: HistoricalParams): Promise<any> {
      const resp = await axios.post(`${BASE}/instruments/historical`, params, { headers: hdrs(true), timeout: 30000 });
      return resp.data;
    },

    async getOptionChain(params: OptionChainParams): Promise<any> {
      const resp = await axios.get(`${BASE}/GetOptionChain/${params.underlying}/${params.expiry}/${params.strike || ''}`,
        { headers: hdrs(true), timeout: 15000 });
      return resp.data;
    },

    // ── Portfolio ──

    async getPositions(): Promise<any> {
      const resp = await axios.get(`${BASE}/portfolio/positions`, { headers: hdrs(true), timeout: 15000 });
      return resp.data;
    },

    async getHoldings(): Promise<any> {
      const resp = await axios.get(`${BASE}/portfolio/holdings`, { headers: hdrs(true), timeout: 15000 });
      return resp.data;
    },

    async placeOrder(params: Record<string, unknown>): Promise<any> {
      const resp = await axios.post(`${BASE}/orders/regular`, params, { headers: hdrs(true), timeout: 15000 });
      return resp.data;
    },
  };
}
