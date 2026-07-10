const axios = require('axios');
const { BaseOMS } = require('./base');
const logger = require('../utils/logger');

class MStockOMS extends BaseOMS {
  constructor(config) {
    super(config);
    this.name = 'mstock';
    this.baseUrl = config.mstock.baseUrl;
    this.apiKey = config.mstock.apiKey;
    this.accessToken = config.mstock.accessToken;
    this.clientCode = config.mstock.clientCode;
    this.endpoints = config.mstock.endpoints;
    this.connected = false;
  }

  async connect() {
    if (!this.apiKey) throw new Error('MStock credentials not configured');
    this.connected = true;
    logger.info('MStockOMS: connected');
  }

  async disconnect() {
    this.connected = false;
  }

  /** Token comes from the central Broker Session Service (Redis), not from env, in the target design. */
  setAccessToken(token) {
    this.accessToken = token;
  }

  /**
   * LiveExecutor requires a broker-side resting stop (SL-M) and fill confirmation.
   * The MStock Type B order endpoints in `config.mstock.endpoints` are UNVERIFIED against
   * the official docs: placeOrder below sends no trigger price, no ordertag and no
   * order-type passthrough, and there is no getOrderStatus().
   *
   * Returning false makes LiveExecutor refuse to construct with this OMS — deliberately
   * failing closed rather than trading an option with no stop-loss. Flip this to true only
   * after the Orders API is implemented and verified against the MStock docs.
   */
  supportsRestingStop() {
    return false;
  }

  async placeOrder(order) {
    const body = {
      clientCode: this.clientCode,
      exchange: 'NFO',
      symbol: order.symbol,
      side: order.action === 'BUY' ? 'B' : 'S',
      quantity: order.quantity,
      price: order.price || 0,
      orderType: order.price ? 'LIMIT' : 'MARKET',
      productType: 'I',
      validity: 'DAY',
    };
    return this.post(this.endpoints.placeOrder, body);
  }

  async modifyOrder(orderId, modifications) {
    const body = {
      clientCode: this.clientCode,
      orderNo: orderId,
      quantity: modifications.quantity || 0,
      price: modifications.price || 0,
      orderType: modifications.price ? 'LIMIT' : 'MARKET',
    };
    return this.post(this.endpoints.modifyOrder, body);
  }

  async cancelOrder(orderId) {
    const body = { clientCode: this.clientCode, orderNo: orderId };
    return this.post(this.endpoints.cancelOrder, body);
  }

  async getOrderBook() {
    return this.post(this.endpoints.orderBook, { clientCode: this.clientCode });
  }

  async getPositions() {
    return this.post(this.endpoints.positions, { clientCode: this.clientCode });
  }

  async getQuote(symbol) {
    const res = await this.post(this.endpoints.quote, { clientCode: this.clientCode, symbol });
    if (res) {
      return { ltp: parseFloat(res.lastPrice || 0), bid: parseFloat(res.bid || 0), ask: parseFloat(res.ask || 0), oi: parseInt(res.oi || 0) };
    }
    return null;
  }

  async post(path, data) {
    const url = `${this.baseUrl}${path}`;
    // MStock Type B requires ALL THREE on authenticated calls:
    //   X-Mirae-Version: 1
    //   X-PrivateKey:    <api_key>          <-- omitting this returns
    //                                           "API is suspended/expired for use"
    //   Authorization:   Bearer <jwtToken>
    const headers = {
      'Content-Type': 'application/json',
      'X-Mirae-Version': '1',
    };
    if (this.apiKey) headers['X-PrivateKey'] = this.apiKey;
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;

    const res = await axios.post(url, data, { headers, timeout: 10000 });
    return res.data;
  }
}

module.exports = { MStockOMS };
