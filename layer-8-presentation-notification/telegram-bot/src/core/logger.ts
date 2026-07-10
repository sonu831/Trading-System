const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty', // Usually dev-only, but good for this setup
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
    },
  },
  base: {
    instanceId: config.app.instanceId,
    hostname: config.app.hostname,
  },
  // Redact sensitive keys
  redact: {
    paths: ['token', 'password', 'authorization'],
    remove: true,
  },
});

module.exports = logger;
