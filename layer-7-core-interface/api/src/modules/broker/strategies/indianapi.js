const { connected } = require('./base');

/**
 * IndianAPI — a data-only source with no authentication.
 *
 * The fourth shape: nothing to log into. It returns `token: null`, which tells the session
 * service there is no session to cache. Modelling "no auth" explicitly keeps the rest of
 * the system from special-casing it.
 */
module.exports = {
  id: 'indianapi',
  label: 'IndianAPI (public data)',
  requiredFields: [],
  optionalFields: ['api_key'],
  interactiveInputs: [],
  capabilities: { data: true, execution: false, restingStop: false, orderStatus: false },

  ttlSeconds: () => 0,

  canAuthenticateUnattended: () => true,

  async authenticate() {
    return connected({
      token: null, // nothing to cache
      ttlSeconds: 0,
      meta: {
        broker: 'indianapi',
        auth_type: 'none',
        note: 'IndianAPI does not require authentication (throttle-limited).',
      },
    });
  },
};
