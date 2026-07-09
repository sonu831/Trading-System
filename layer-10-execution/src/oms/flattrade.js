const axios = require('axios');
const { BaseOMS } = require('./base');
const logger = require('../utils/logger');

class FlatTradeOMS extends BaseOMS {
  constructor(config) {
    super(config);
    this.name = 'flattrade';
    this.userId = config.flattrade.userId;
    this.accountId = config.flattrade.accountId || config.flattrade.userId;
    this.apiKey = config.flattrade.apiKey;
    this.baseUrl = config.flattrade.baseUrl;
    this.token = config.flattrade.token;
    this.connected = false;
  }

  async connect() {
    if (!this.apiKey || !this.userId) throw new Error('FlatTrade credentials not configured');
    this.connected = true;
    logger.info('FlatTradeOMS: connected');
  }

  async disconnect() {
    this.connected = false;
  }

  async placeOrder(order) {
    const payload = {
      uid: this.userId,
      actid: this.accountId,
      exch: 'NFO',
      tsym: order.symbol,
      qty: String(order.quantity),
      prc: String(order.price || 0),
      trgprc: '0',
      dscqty: '0',
      prctyp: order.price ? 'LMT' : 'MKT',
      trantype: order.action === 'BUY' ? 'B' : 'S',
      ret: 'DAY',
    };
    return this.callApi('placeOrder', payload);
  }

  async modifyOrder(orderId, modifications) {
    const payload = {
      uid: this.userId,
      actid: this.accountId,
      nstordno: orderId,
      qty: String(modifications.quantity || ''),
      prc: String(modifications.price || 0),
      trgprc: '0',
      prctyp: modifications.price ? 'LMT' : 'MKT',
    };
    return this.callApi('modifyOrder', payload);
  }

  async cancelOrder(orderId) {
    const payload = { uid: this.userId, actid: this.accountId, nstordno: orderId };
    return this.callApi('cancelOrder', payload);
  }

  async getOrderBook() {
    const payload = { uid: this.userId, actid: this.accountId };
    return this.callApi('orderBook', payload);
  }

  async getPositions() {
    const payload = { uid: this.userId, actid: this.accountId };
    return this.callApi('positions', payload);
  }

  async getQuote(symbol) {
    const payload = { uid: this.userId, token: symbol, exch: 'NFO' };
    const body = `jData=${JSON.stringify(payload)}&jKey=${this.apiKey}`;
    const res = await axios.post(`${this.baseUrl}/REST/GetQuotes`, body, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 5000,
    });
    if (res.data?.stat === 'Ok') {
      return { ltp: parseFloat(res.data.lp || 0), bid: parseFloat(res.data.bp || 0), ask: parseFloat(res.data.sp || 0), oi: parseInt(res.data.oi || 0) };
    }
    return null;
  }

  async callApi(endpoint, payload) {
    const url = `${this.baseUrl}/REST/${this.capitalize(endpoint)}`;
    const body = `jData=${JSON.stringify(payload)}&jKey=${this.apiKey}`;
    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'text/plain' },
      timeout: 10000,
    });
    if (res.data?.stat !== 'Ok') throw new Error(`FlatTrade ${endpoint} failed: ${res.data?.emsg || JSON.stringify(res.data)}`);
    return res.data;
  }

  capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }
}

module.exports = { FlatTradeOMS };
