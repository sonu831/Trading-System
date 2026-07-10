const express = require('express');
const bootstrap = require('./core/bootstrap');
const { createBot } = require('./bot');
const config = require('./config');
const logger = require('./core/logger');
const metrics = require('./core/metrics');

// Create Express Server for Health/Metrics
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'UP', instance: config.app.instanceId });
});

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', metrics.register.contentType);
  res.send(await metrics.register.metrics());
});

// App Logic
const main = async () => {
  // Start Server
  app.listen(config.app.port, () => {
    logger.info({ port: config.app.port }, '📡 HTTP Server listening');
  });

  // Initialize Core Services & Bot
  await bootstrap.init(async () => {
    const bot = createBot();

    // Launch Bot with retry logic handled by Telegraf internally usually,
    // but explicit launch is good.
    await bot.launch({
      dropPendingUpdates: false,
    });

    logger.info('🤖 Bot polling started successfully');

    // Publish restart event to Kafka (via core/kafka if needed later)
  });
};

main();
