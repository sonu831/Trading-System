/**
 * Broker auth strategy contract — every provider implements this shape.
 *
 * Three outcomes only: connected | needs_input | error.
 * Adding a broker = implement this contract + register in strategies/index.ts.
 */

export interface BrokerAuthStrategy {
  id: string;
  label: string;
  requiredFields: string[];
  optionalFields: string[];
  interactiveInputs: string[];
  capabilities: {
    data: boolean;
    execution: boolean;
    restingStop: boolean;
    orderStatus: boolean;
  };
  ttlSeconds(now: Date): number;
  canAuthenticateUnattended(creds: Record<string, string>): boolean;
  authenticate(creds: Record<string, string>, deps: StrategyDeps, ctx: AuthContext): Promise<AuthResult>;
}

import type { BrokerAdapter } from '../adapters/broker-adapter.interface';

export interface StrategyDeps {
  http: any;
  generateTOTP(secret: string): string;
  sha256(s: string): string;
  now?: Date;
  adapter?: BrokerAdapter;
}

export interface AuthContext {
  input?: Record<string, unknown> | null;
  pending?: Record<string, unknown> | null;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  ttlSeconds?: number;
  status?: 'connected' | 'needs_input' | 'error';
  stage?: string;
  error?: string;
  provider?: string;
  auth_type?: string;
  pending?: Record<string, unknown>;
  pendingTtlSeconds?: number;
}

/** MStock tokens die at IST midnight per official docs. */
export function secondsUntilISTMidnight(now: Date = new Date()): number {
  const IST = 5.5 * 3600000;
  const ist = new Date(now.getTime() + IST);
  const next = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0, 0);
  return Math.max(60, Math.floor((next - ist.getTime()) / 1000) - 120);
}

export function secondsUntilNextISTHour(targetHour?: number, now?: Date): number {
  // Support: secondsUntilNextISTHour(now: Date) and secondsUntilNextISTHour(hour: number, now: Date)
  let hourTarget: number | undefined;
  let date: Date;
  if (typeof targetHour === 'number' && now instanceof Date) {
    hourTarget = targetHour;
    date = now;
  } else if (targetHour instanceof Date) {
    date = targetHour;
  } else {
    date = new Date();
  }
  const IST = 5.5 * 3600000;
  const ist = new Date(date.getTime() + IST);
  const currentHour = ist.getUTCHours();
  const currentMin = ist.getUTCMinutes();
  const currentSec = ist.getUTCSeconds();
  const nextHour = hourTarget != null ? hourTarget : currentHour + 1;
  const dayOffset = nextHour <= currentHour ? 1 : 0;
  const diffHours = nextHour - currentHour + (dayOffset * 24);
  const diffSeconds = diffHours * 3600 - currentMin * 60 - currentSec;
  return Math.max(60, diffSeconds - 120);
}
