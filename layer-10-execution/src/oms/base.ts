import type { OrderType, OrderResult, QuoteResult, OrderStatus } from '../../shared/types';

export interface OrderRequest {
  exchange: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number | null;
  orderType: OrderType;
  productType: string;
  validity: string;
  ordertag?: string;
  triggerPrice?: number;
}

export interface OrderModification {
  quantity?: number;
  price?: number | null;
  orderType?: OrderType;
  exchange?: string;
  symbol?: string;
  validity?: string;
  triggerPrice?: number;
}

export abstract class BaseOMS {
  name: string;
  protected config: Record<string, any>;
  connected: boolean;

  constructor(config: Record<string, any>) {
    this.name = 'base';
    this.config = config;
    this.connected = false;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  abstract placeOrder(order: OrderRequest): Promise<OrderResult>;
  abstract modifyOrder(orderId: string, modifications: OrderModification): Promise<OrderResult>;
  abstract cancelOrder(orderId: string | { orderId: string }): Promise<unknown>;
  abstract getOrderBook(): Promise<unknown[]>;
  abstract getPositions(): Promise<unknown[]>;
  abstract getQuote(symbol: string): Promise<QuoteResult | null>;

  supportsRestingStop(): boolean { return false; }
  getOrderStatus?(orderId: string): Promise<OrderStatus | null>;
}

export = { BaseOMS };
export type { OrderRequest, OrderModification };
