/**
 * IndianAPI — no-auth public data source.
 * Returns token: null explicitly so the session service doesn't special-case it.
 */
import type { BrokerAuthStrategy, StrategyDeps, AuthContext, AuthResult } from './base';

const strategy: BrokerAuthStrategy = {
  id: 'indianapi', label: 'IndianAPI (public data)',
  requiredFields: [], optionalFields: ['api_key'],
  interactiveInputs: [],
  capabilities: { data: true, execution: false, restingStop: false, orderStatus: false },

  ttlSeconds: () => 0,
  canAuthenticateUnattended: () => true,

  async authenticate(): Promise<AuthResult> {
    return {
      success: true, status: 'connected', token: null, ttlSeconds: 0,
      provider: 'indianapi', auth_type: 'none',
    };
  },
};

module.exports = strategy;
