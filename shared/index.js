/**
 * shared/index.js — CommonJS barrel. The single runtime entry point for shared/.
 *
 * Usage:  const { KAFKA_TOPICS, PORTS, REDIS_KEYS } = require('/app/shared');
 *
 * Works in ANY Node.js context — Docker, local dev, scripts, tests. No ts-node/tsx needed.
 * Types come from index.d.ts; there is deliberately NO index.ts twin (no-ts-js-twins gate).
 *
 * This SPREADS everything constants.js exports rather than listing keys by hand. Listing them
 * meant every new constant had to be added in two places, and it kept drifting — the
 * constants-parity test caught `KAFKA_TOPICS` and four broker maps missing here. Spreading makes
 * "the barrel re-exports every constant" true by construction.
 */
module.exports = {
  ...require('./constants'),
};
