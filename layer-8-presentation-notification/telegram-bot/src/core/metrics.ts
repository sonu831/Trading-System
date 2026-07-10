const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// --- Metrics Definitions ---

const updatesReceived = new client.Counter({
  name: 'telegram_updates_total',
  help: 'Total Telegram updates received',
  labelNames: ['type'],
});

const messagesSent = new client.Counter({
  name: 'telegram_messages_sent_total',
  help: 'Total messages sent by bot',
  labelNames: ['type', 'status'], // type: reply, broadcast
});

const commandLatency = new client.Histogram({
  name: 'telegram_command_duration_seconds',
  help: 'Command execution time',
  labelNames: ['command'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

const activeUsers = new client.Gauge({
  name: 'telegram_active_users_daily',
  help: 'Unique users seen today',
});

const botErrors = new client.Counter({
  name: 'telegram_bot_errors_total',
  help: 'Total errors encountered',
  labelNames: ['type', 'code'],
});

// Register all
register.registerMetric(updatesReceived);
register.registerMetric(messagesSent);
register.registerMetric(commandLatency);
register.registerMetric(activeUsers);
register.registerMetric(botErrors);

module.exports = {
  register,
  metrics: {
    updatesReceived,
    messagesSent,
    commandLatency,
    activeUsers,
    botErrors,
  },
};
