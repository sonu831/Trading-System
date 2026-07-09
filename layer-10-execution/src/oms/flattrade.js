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

  /** This adapter CAN place resting stop orders (SL-MKT/SL-LMT). */
  supportsRestingStop() {
    return true;
  }

  /**
   * Place an order.
   * @param {object} order
   *   symbol, action ('BUY'|'SELL'), quantity,
   *   orderType: 'MKT' | 'LMT' | 'SL-MKT' | 'SL-LMT'   (Noren prctyp)
   *   price, triggerPrice,
   *   productType: 'INTRADAY' | 'NRML'  -> Noren prd 'I' | 'M'
   *   validity: 'DAY' | 'IOC',
   *   ordertag  -> Noren `remarks` (idempotency / correlation key)
   * @returns {{orderId: string, raw: object}}
   */
  async placeOrder(order) {
    const orderType = order.orderType || (order.price > 0 ? 'LMT' : 'MKT');
    const isStop = orderType.startsWith('SL');

    const payload = {
      uid: this.userId,
      actid: this.accountId,
      exch: order.exchange || 'NFO',
      tsym: order.symbol,
      qty: String(order.quantity),
      // Market orders must carry price 0; stop-market needs a trigger, not a price.
      prc: String(orderType === 'MKT' || orderType === 'SL-MKT' ? 0 : order.price || 0),
      trgprc: String(isStop ? order.triggerPrice || 0 : 0),
      dscqty: '0',
      prctyp: orderType,
      trantype: order.action === 'BUY' ? 'B' : 'S',
      prd: this.productCode(order.productType),
      ret: order.validity || 'DAY',
    };
    // `remarks` is how the ordertag reaches the broker — required for idempotent retries.
    if (order.ordertag) payload.remarks = order.ordertag;

    const res = await this.callApi('placeOrder', payload);
    return { orderId: res.norenordno, raw: res };
  }

  async modifyOrder(orderId, modifications = {}) {
    const orderType = modifications.orderType || (modifications.price > 0 ? 'LMT' : 'MKT');
    const isStop = orderType.startsWith('SL');
    const payload = {
      uid: this.userId,
      actid: this.accountId,
      exch: modifications.exchange || 'NFO',
      norenordno: orderId,
      prctyp: orderType,
      prc: String(orderType === 'MKT' || orderType === 'SL-MKT' ? 0 : modifications.price || 0),
      trgprc: String(isStop ? modifications.triggerPrice || 0 : 0),
    };
    if (modifications.quantity) payload.qty = String(modifications.quantity);
    if (modifications.symbol) payload.tsym = modifications.symbol;
    return this.callApi('modifyOrder', payload);
  }

  /** @param {string} orderId - broker order number (norenordno) */
  async cancelOrder(orderId) {
    const id = typeof orderId === 'object' ? orderId.orderId || orderId.norenordno : orderId;
    if (!id) throw new Error('cancelOrder: orderId required');
    const payload = { uid: this.userId, actid: this.accountId, norenordno: String(id) };
    return this.callApi('cancelOrder', payload);
  }

  async getOrderBook() {
    const payload = { uid: this.userId, actid: this.accountId };
    return this.callApi('orderBook', payload);
  }

  /**
   * Look up a single order's live status. The broker's book is the source of truth.
   * @returns {{status:string, filledQty:number, avgPrice:number, raw:object}|null}
   */
  async getOrderStatus(orderId) {
    const book = await this.getOrderBook();
    const orders = Array.isArray(book) ? book : book?.orders || [];
    const row = orders.find((o) => String(o.norenordno) === String(orderId));
    if (!row) return null;
    return {
      status: row.status, // COMPLETE | OPEN | REJECTED | CANCELED | TRIGGER_PENDING
      filledQty: parseInt(row.fillshares || 0, 10),
      avgPrice: parseFloat(row.avgprc || 0),
      raw: row,
    };
  }

  /** Noren product codes: I = intraday (MIS), M = normal (carry-forward). */
  productCode(productType) {
    if (!productType) return 'I';
    const p = String(productType).toUpperCase();
    if (p === 'NRML' || p === 'M') return 'M';
    return 'I';
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
