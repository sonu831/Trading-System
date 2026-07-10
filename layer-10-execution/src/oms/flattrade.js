const axios = require('axios');
const { BaseOMS } = require('./base');
const logger = require('../utils/logger');

/**
 * FlatTrade (Pi Connect / Noren) order adapter.
 *
 * Verified against the official Pi Connect docs:
 *   Base URL : https://piconnect.flattrade.in/PiConnectAPI      (NOT /PiConnectTP, no /REST/)
 *   Wire     : POST  body `jData=<json>&jKey=<token>`,  Content-Type: application/json
 *   jKey     : the token from the login flow — NOT the api_key.
 *
 * Endpoints used: /PlaceOrder /ModifyOrder /CancelOrder /OrderBook /SingleOrdHist
 *                 /PositionBook /GetQuotes
 *
 * Response shapes differ per endpoint:
 *   PlaceOrder   -> { stat:'Ok', norenordno }            (object)
 *   OrderBook    -> [ {...}, {...} ]                     (ARRAY on success)
 *   SingleOrdHist-> [ {...} ]                            (ARRAY on success)
 *   failure      -> { stat:'Not_Ok', emsg }              (object)
 */

const NOREN_PRODUCT = { INTRADAY: 'I', MIS: 'I', I: 'I', NRML: 'M', M: 'M', CNC: 'C', C: 'C' };

/**
 * Noren order states, normalised to the canonical set the executor understands.
 * The broker says "REJECT" (not "REJECTED") and "Open"/"COMPLETE" in mixed case — matching
 * on the raw string means a rejected order looks "still pending" until the poll times out.
 */
function normalizeStatus(raw) {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'COMPLETE' || s === 'FILLED') return 'COMPLETE';
  if (s === 'REJECT' || s === 'REJECTED') return 'REJECTED';
  if (s === 'CANCELED' || s === 'CANCELLED') return 'CANCELED';
  if (s === 'TRIGGER_PENDING') return 'TRIGGER_PENDING';
  if (s === 'OPEN') return 'OPEN';
  if (s === 'PENDING') return 'PENDING';
  return s || 'UNKNOWN';
}

class FlatTradeOMS extends BaseOMS {
  constructor(config) {
    super(config);
    this.name = 'flattrade';
    this.userId = config.flattrade.userId;
    this.accountId = config.flattrade.accountId || config.flattrade.userId;
    this.apiKey = config.flattrade.apiKey;
    this.baseUrl = (config.flattrade.baseUrl || 'https://piconnect.flattrade.in/PiConnectAPI').replace(/\/$/, '');
    // jKey. In the target design this is injected from the central Broker Session Service.
    this.token = config.flattrade.token;
    this.connected = false;
  }

  async connect() {
    if (!this.userId) throw new Error('FlatTrade credentials not configured (userId)');
    if (!this.jKey()) throw new Error('FlatTrade session token (jKey) not available — connect the provider first');
    this.connected = true;
    logger.info('FlatTradeOMS: connected');
  }

  async disconnect() {
    this.connected = false;
  }

  /** Token from the central session service (Redis), not from env, in the target design. */
  setAccessToken(token) {
    this.token = token;
  }

  /** The api_key is NOT the jKey — using it will fail with "Invalid Session Key". */
  jKey() {
    return this.token;
  }

  /** This adapter CAN place resting stop orders (SL-MKT / SL-LMT). */
  supportsRestingStop() {
    return true;
  }

  /**
   * @param {object} order symbol, action('BUY'|'SELL'), quantity, orderType('MKT'|'LMT'|'SL-MKT'|'SL-LMT'),
   *                       price, triggerPrice, productType('INTRADAY'|'NRML'), validity('DAY'|'IOC'|'EOS'), ordertag
   * @returns {{orderId: string, raw: object}}
   */
  async placeOrder(order) {
    const orderType = order.orderType || (order.price > 0 ? 'LMT' : 'MKT');
    const isStop = orderType.startsWith('SL');

    const data = {
      uid: this.userId,
      actid: this.accountId,
      exch: order.exchange || 'NFO',
      tsym: order.symbol,
      qty: String(order.quantity),
      // Market orders carry price 0; a stop-market carries a trigger, not a price.
      prc: String(orderType === 'MKT' || orderType === 'SL-MKT' ? 0 : order.price || 0),
      dscqty: '0',
      prd: this.productCode(order.productType),
      trantype: order.action === 'BUY' ? 'B' : 'S',
      prctyp: orderType,
      ret: order.validity || 'DAY',
      ordersource: 'API',
    };
    // `trgprc` must only be sent for SL / SL-M orders (docs).
    if (isStop) data.trgprc = String(order.triggerPrice || 0);
    // `remarks` is how the ordertag reaches the broker — required for idempotent retries.
    if (order.ordertag) data.remarks = order.ordertag;

    const res = await this.callApi('PlaceOrder', data);
    return { orderId: res.norenordno, raw: res };
  }

  async modifyOrder(orderId, modifications = {}) {
    const orderType = modifications.orderType || (modifications.price > 0 ? 'LMT' : 'MKT');
    const isStop = orderType.startsWith('SL');

    const data = {
      uid: this.userId,
      exch: modifications.exchange || 'NFO',
      norenordno: String(orderId),
      prctyp: orderType,
      prc: String(orderType === 'MKT' || orderType === 'SL-MKT' ? 0 : modifications.price || 0),
      ret: modifications.validity || 'DAY',
    };
    if (isStop) data.trgprc = String(modifications.triggerPrice || 0);
    if (modifications.quantity) data.qty = String(modifications.quantity);
    if (modifications.symbol) data.tsym = modifications.symbol;

    return this.callApi('ModifyOrder', data);
  }

  /** @param {string} orderId broker order number (norenordno) */
  async cancelOrder(orderId) {
    const id = typeof orderId === 'object' ? orderId.orderId || orderId.norenordno : orderId;
    if (!id) throw new Error('cancelOrder: orderId required');
    return this.callApi('CancelOrder', { uid: this.userId, norenordno: String(id) });
  }

  /** @returns {Promise<Array>} */
  async getOrderBook() {
    const res = await this.callApi('OrderBook', { uid: this.userId });
    return Array.isArray(res) ? res : [];
  }

  /**
   * Single-order status. The broker's book is the source of truth for fills.
   * SingleOrdHist returns the order's state transitions, newest first.
   * @returns {{status:string, filledQty:number, avgPrice:number, raw:object}|null}
   */
  async getOrderStatus(orderId) {
    let rows;
    try {
      rows = await this.callApi('SingleOrdHist', { uid: this.userId, norenordno: String(orderId) });
    } catch (err) {
      logger.debug({ err, orderId }, 'FlatTradeOMS: SingleOrdHist failed');
      return null;
    }
    if (!Array.isArray(rows) || rows.length === 0) return null;

    // Prefer a terminal state if one exists anywhere in the history.
    const TERMINAL = new Set(['COMPLETE', 'REJECTED', 'CANCELED']);
    const terminal = rows.find((r) => TERMINAL.has(normalizeStatus(r.status)));
    const row = terminal || rows[0];

    return {
      status: normalizeStatus(row.status),
      filledQty: parseInt(row.fillshares || 0, 10),
      avgPrice: parseFloat(row.avgprc || 0),
      rejectReason: row.rejreason || null,
      raw: row,
    };
  }

  async getPositions() {
    const res = await this.callApi('PositionBook', { uid: this.userId, actid: this.accountId });
    return Array.isArray(res) ? res : [];
  }

  async getQuote(symbol) {
    // GetQuotes expects the numeric contract token in `token`, not a trading symbol.
    const res = await this.callApi('GetQuotes', { uid: this.userId, exch: 'NFO', token: String(symbol) });
    if (!res) return null;
    return {
      ltp: parseFloat(res.lp || 0),
      bid: parseFloat(res.bp || 0),
      ask: parseFloat(res.sp || 0),
      oi: parseInt(res.oi || 0, 10),
    };
  }

  /**
   * POST `${baseUrl}/${endpoint}` with the Noren body.
   * Success may be an OBJECT (`stat:'Ok'`) or an ARRAY (OrderBook/SingleOrdHist/PositionBook).
   * The previous version checked `res.data.stat !== 'Ok'` unconditionally and therefore threw
   * on every array response.
   */
  async callApi(endpoint, data) {
    const jKey = this.jKey();
    if (!jKey) throw new Error('FlatTrade: no session token (jKey)');

    const url = `${this.baseUrl}/${endpoint}`;
    const body = `jData=${JSON.stringify(data)}&jKey=${jKey}`;

    const res = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    const payload = res.data;

    if (Array.isArray(payload)) {
      // An array is a success response; a failed list call returns an object instead.
      return payload;
    }
    if (payload?.stat && payload.stat !== 'Ok') {
      throw new Error(`FlatTrade ${endpoint} failed: ${payload.emsg || JSON.stringify(payload)}`);
    }
    if (!payload?.stat && payload?.emsg) {
      throw new Error(`FlatTrade ${endpoint} failed: ${payload.emsg}`);
    }
    return payload;
  }

  /** Noren product codes: I = intraday (MIS), M = NRML, C = CNC. */
  productCode(productType) {
    if (!productType) return 'I';
    return NOREN_PRODUCT[String(productType).toUpperCase()] || 'I';
  }
}

module.exports = { FlatTradeOMS, normalizeStatus };
