/**
 * Broker Adapter Registry — one wrapper per external system.
 *
 * Adding a broker = create the adapter file + register it here.
 * Zero edits to strategies, service, or API routes.
 */
import type { BrokerAdapter } from './broker-adapter.interface';
import { createMStockAdapter } from './mstock.adapter';

const factory: Record<string, (apiKey: string) => BrokerAdapter> = {
  mstock: createMStockAdapter,
};

const instance: Record<string, BrokerAdapter> = {};

export function getAdapter(provider: string, apiKey?: string): BrokerAdapter | null {
  if (!instance[provider] && apiKey && factory[provider]) {
    instance[provider] = factory[provider](apiKey);
  }
  return instance[provider] || null;
}

export function clearAdapter(provider: string): void {
  delete instance[provider];
}

export { BrokerAdapter, LoginParams, LoginResult, VerifyResult } from './broker-adapter.interface';
