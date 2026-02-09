require('dotenv').config();

const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 7001,
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://redis:6379',
  },
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'kafka:29092').split(','),
    topic: process.env.KAFKA_NOTIFICATION_TOPIC || 'notifications',
    clientId: 'email-service',
    groupId: 'email-service-group',
  },
  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SYSTEM_EMAIL || 'system@stocks-guru.com',
    admins: (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@example.com')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0),
  },
};

module.exports = config;
