import type { ProviderName } from '@shared/types';
import * as mstock from './mstock';
import * as flattrade from './flattrade';
import * as kite from './kite';
import * as indianapi from './indianapi';
import type { BrokerAuthStrategy } from './base';

/**
 * Broker auth strategy registry.
 *
 * Adding a broker = add a file here + one line below. Nothing else in the system changes:
 * the session service, the API and the dashboard all read the strategy's declared
 * `requiredFields` / `interactiveInputs` / `capabilities`.
 */

const STRATEGIES: Record<ProviderName, BrokerAuthStrategy> = {
  mstock, flattrade, kite, indianapi,
};

/** Sanity-check a strategy at load time so a malformed one fails fast, not at 09:15. */
function assertValid(s: BrokerAuthStrategy): void {
  const problems: string[] = [];
  if (!s.id) problems.push('missing id');
  if (!Array.isArray(s.requiredFields)) problems.push('requiredFields must be an array');
  if (!Array.isArray(s.interactiveInputs)) problems.push('interactiveInputs must be an array');
  if (typeof s.authenticate !== 'function') problems.push('authenticate() must be a function');
  if (typeof s.ttlSeconds !== 'function') problems.push('ttlSeconds() must be a function');
  if (typeof s.canAuthenticateUnattended !== 'function') problems.push('canAuthenticateUnattended() must be a function');
  if (!s.capabilities) problems.push('missing capabilities');
  if (problems.length) throw new Error(`Broker strategy "${s.id || '?'}" invalid: ${problems.join('; ')}`);
}
Object.values(STRATEGIES).forEach(assertValid);

export const getStrategy = (provider: string): BrokerAuthStrategy | null =>
  (STRATEGIES as Record<string, BrokerAuthStrategy>)[provider] || null;

export const listStrategies = () =>
  Object.values(STRATEGIES).map((s) => ({
    id: s.id,
    label: s.label,
    requiredFields: s.requiredFields,
    optionalFields: s.optionalFields || [],
    interactiveInputs: s.interactiveInputs,
    interactive: s.interactiveInputs.length > 0,
    capabilities: s.capabilities,
  }));

export { STRATEGIES };
export * from './base';
