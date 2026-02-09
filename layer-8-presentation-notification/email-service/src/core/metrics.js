const promClient = require('prom-client');
const config = require('../config');

// Create Registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'email_service_' });

// Define Metrics
const metrics = {
  emailsSent: new promClient.Counter({
    name: 'email_sent_total',
    help: 'Total emails successfully sent',
    labelNames: ['recipient', 'type'],
  }),
  emailsFailed: new promClient.Counter({
    name: 'email_failed_total',
    help: 'Total emails that failed to send',
    labelNames: ['recipient', 'type', 'error_code'],
  }),
  emailDuration: new promClient.Histogram({
    name: 'email_send_duration_seconds',
    help: 'Time taken to send emails',
    labelNames: ['type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
  notificationsReceived: new promClient.Counter({
    name: 'email_notifications_received_total',
    help: 'Total notifications received from Redis/Kafka',
    labelNames: ['channel', 'source'],
  }),
  kafkaProcessed: new promClient.Counter({
    name: 'kafka_processed_total',
    help: 'Total Kafka messages processed',
    labelNames: ['type', 'status'],
  }),
};

// Register all metrics
Object.values(metrics).forEach((metric) => register.registerMetric(metric));

// Update initial gauges if any (none currently)

module.exports = {
  register,
  ...metrics,
};
