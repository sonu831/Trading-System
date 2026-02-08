const pino = require('pino');

// Build logger config - use pino-loki in production when LOKI_URL is set,
// otherwise use simple stdout without transport (no pino-pretty dependency)
const buildLoggerConfig = () => {
  const lokiUrl = process.env.LOKI_URL;
  const useStdout = process.env.LOG_TO_STDOUT === 'true' || !lokiUrl;

  if (useStdout) {
    // Simple stdout logger - no transport dependency required
    return {
      level: 'info',
    };
  }

  // Use pino-loki with async batching to prevent blocking
  return {
    level: 'info',
    transport: {
      target: 'pino-loki',
      options: {
        host: lokiUrl,
        labels: { app: 'layer-7-api' },
        batching: true,
        interval: 5,
        silenceErrors: true, // Don't throw if Loki is unavailable
      },
    },
  };
};

// Create root logger instance for standalone usage (e.g., Redis Client)
const logger = pino(buildLoggerConfig());

module.exports = { 
  loggerConfig: buildLoggerConfig(),
  logger
};
