const base = require('./base');
const mstock = require('./mstock');
const flattrade = require('./flattrade');
const kite = require('./kite');
const indianapi = require('./indianapi');

/**
 * Broker auth strategy registry.
 *
 * Adding a broker = add a file here + one line below. Nothing else in the system changes:
 * the session service, the API and the dashboard all read the strategy's declared
 * `requiredFields` / `interactiveInputs` / `capabilities`.
 */
const STRATEGIES = { mstock, flattrade, kite, indianapi };

/** Sanity-check a strategy at load time so a malformed one fails fast, not at 09:15. */
function assertValid(s) {
  const problems = [];
  if (!s.id) problems.push('missing id');
  if (!Array.isArray(s.requiredFields)) problems.push('requiredFields must be an array');
  if (!Array.isArray(s.interactiveInputs)) problems.push('interactiveInputs must be an array');
  if (typeof s.authenticate !== 'function') problems.push('authenticate() must be a function');
  if (typeof s.ttlSeconds !== 'function') problems.push('ttlSeconds() must be a function');
  // Required: a strategy that cannot say whether it runs unattended will get auto-refreshed,
  // and for MStock that means mailing the operator a real OTP on every cache miss.
  if (typeof s.canAuthenticateUnattended !== 'function') problems.push('canAuthenticateUnattended() must be a function');
  if (!s.capabilities) problems.push('missing capabilities');
  if (problems.length) throw new Error(`Broker strategy "${s.id || '?'}" invalid: ${problems.join('; ')}`);
}
Object.values(STRATEGIES).forEach(assertValid);

const getStrategy = (provider) => STRATEGIES[provider] || null;

const listStrategies = () =>
  Object.values(STRATEGIES).map((s) => ({
    id: s.id,
    label: s.label,
    requiredFields: s.requiredFields,
    optionalFields: s.optionalFields || [],
    interactiveInputs: s.interactiveInputs,
    interactive: s.interactiveInputs.length > 0,
    capabilities: s.capabilities,
  }));

module.exports = { STRATEGIES, getStrategy, listStrategies, ...base };
