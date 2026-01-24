const os = require('os');
const crypto = require('crypto');

// Generate unique instance ID
const INSTANCE_ID = crypto.randomBytes(4).toString('hex');
const HOSTNAME = os.hostname();

module.exports = {
  // App Identifiers
  app: {
    instanceId: INSTANCE_ID,
    hostname: HOSTNAME,
    env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || 7000,
  },

  // Telegram
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN,
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL,
  },

  // Infrastructure
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(','),
    clientId: 'telegram-bot-consumer',
    groupId: 'telegram-notification-group',
    topic: 'notifications',
  },

  // API Endpoints
  api: {
    backend: process.env.BACKEND_API_URL || 'http://backend-api:4000/api/v1',
  },

  // Feature Flags / Constants
  features: {
    maxRetries: 5,
    requestTimeout: 5000,
  },
};
