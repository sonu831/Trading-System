import axios from 'axios';
import { BaseOMS } from './base';
import type { OrderRequest, OrderModification } from './base';
import type { QuoteResult, OrderResult } from '../../shared/types';
import { logger } from '../utils/logger';

interface MStockConfig {
  baseUrl: string;
  apiKey: string;
  accessToken: string;
  clientCode: string;
  endpoints: Record<string, string>;
}

export class MStockOMS extends BaseOMS {
  private baseUrl: string;
  private apiKey: string;
  private accessToken: string;
  private clientCode: string;
  private endpoints: Record<string, string>;

  constructor(config: Record<string, any>) {
    super(config);
    const m = config.mstock as MStockConfig;
    this.name = 'mstock';
    this.baseUrl = m.baseUrl;
    this.apiKey = m.apiKey;
    this.accessToken = m.accessToken;
    this.clientCode = m.clientCode;
    this.endpoints = m.endpoints;
  }

  async connect(): Promise<void> {
    if (!this.apiKey) throw new Error('MStock credentials not configured');
    this.connected = true;
    logger.info('MStockOMS: connected');
  }

  async disconnect(): Promise<void> { this.connected = false; }

  setAccessToken(token: string): void { this.accessToken = token; }

  /**
   * LiveExecutor requires a broker-side resting stop (SL-M) and fill confirmation.
   * Returns false deliberately — fail closed. Flip to true only after Orders API verified.
   */
  supportsRestingStop(): boolean { return false; }

  async placeOrder(order: OrderRequest): Promise<OrderResult> {
    const body = {
      clientCode: this.clientCode, exchange: 'NFO', symbol: order.symbol,
      side: order.action === 'BUY' ? 'B' : 'S', quantity: order.quantity,
      price: order.price ?? null, orderType: order.price ? 'LIMIT' : 'MARKET',
      productType: 'I', validity: 'DAY',
    };
    return this.post(this.endpoints.placeOrder, body);
  }

  async modifyOrder(orderId: string, mods: OrderModification): Promise<OrderResult> {
    const body = {
      clientCode: this.clientCode, orderNo: orderId,
      quantity: mods.quantity ?? null, price: mods.price ?? null,
      orderType: mods.price ? 'LIMIT' : 'MARKET',
    };
    return this.post(this.endpoints.modifyOrder, body);
  }

  async cancelOrder(orderId: string | { orderId: string }): Promise<unknown> {
    const id = typeof orderId === 'object' ? orderId.orderId : orderId;
    return this.post(this.endpoints.cancelOrder, { clientCode: this.clientCode, orderNo: id });
  }

  async getOrderBook(): Promise<unknown[]> {
    return this.post(this.endpoints.orderBook, { clientCode: this.clientCode });
  }

  async getPositions(): Promise<unknown[]> {
    return this.post(this.endpoints.positions, { clientCode: this.clientCode });
  }

  async getQuote(symbol: string): Promise<QuoteResult | null> {
    const res = await this.post(this.endpoints.quote, { clientCode: this.clientCode, symbol }) as Record<string, any>;
    if (!res) return null;
    const ltp = res.lastPrice ? parseFloat(res.lastPrice) : null;
    const bid = res.bid ? parseFloat(res.bid) : null;
    const ask = res.ask ? parseFloat(res.ask) : null;
    const oi = res.oi ? parseInt(res.oi, 10) : null;
    if (ltp == null) logger.warn({ symbol }, 'MStockOMS: quote returned no LTP');
    return { ltp, bid, ask, oi };
  }

  private async post(path: string, data: Record<string, any>): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'X-Mirae-Version': '1',
    };
    if (this.apiKey) headers['X-PrivateKey'] = this.apiKey;
    if (this.accessToken) headers['Authorization'] = `Bearer ${this.accessToken}`;
    const res = await axios.post(url, data, { headers, timeout: 10000 });
    return res.data;
  }
}

// MStockOMS is exported at its declaration; an `export =` alongside it is invalid TS.
