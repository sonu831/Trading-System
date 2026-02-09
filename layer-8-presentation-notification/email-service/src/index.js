const express = require('express');
const { createClient } = require('redis');
const config = require('./config');
const logger = require('./core/logger');
const metrics = require('./core/metrics');
const emailService = require('./services/email.service');
const NotificationEmail = require('./presentation/templates/NotificationEmail');
const { EmailKafkaConsumer } = require('./kafka-consumer');

// Mock Health Check for now
const initHealthMetrics = (register) => {};
const waitForAll = async () => {};

// --- App Setup ---
const app = express();

// --- Redis Client ---
const subscriber = createClient({ url: config.redis.url });
subscriber.on('error', (err) => logger.error({ err }, 'Redis Error'));

// --- Event Handlers ---

/**
 * Handle incoming notification event (Redis/Kafka)
 */
async function handleNotification(channel, message) {
  metrics.notificationsReceived.inc({ channel, source: 'redis' });
  
  try {
    const data = typeof message === 'string' ? JSON.parse(message) : message;
    let emailProps = {};

    // Map channels to email templates
    switch (channel) {
      case 'notifications:suggestions':
        emailProps = {
          title: `💡 Suggestion: ${data.user}`,
          message: data.text,
          details: { Source: data.source, User: data.user },
          type: 'info'
        };
        break;

      case 'notifications:backfill':
        emailProps = {
          title: `📥 Backfill Complete: ${data.symbol}`,
          message: `Backfill job for ${data.symbol} finished successfully.`,
          details: { Symbol: data.symbol, Rows: data.rows, Duration: data.duration },
          type: 'backfill' // maps to success color
        };
        break;
      
      case 'system:alerts':
        emailProps = {
          title: '🚨 System Alert',
          message: typeof data === 'string' ? data : data.message,
          type: 'alert'
        };
        break;

      case 'system:bot_restart':
        emailProps = {
          title: `🔄 Bot Restart: ${data.botName}`,
          message: 'Trading bot has restarted cleanly.',
          details: { Instance: data.instanceId, Host: data.hostname },
          type: 'info'
        };
        break;

      case 'system:down':
        emailProps = {
          title: `🚨 System DOWN: ${data.service}`,
          message: 'Critical service failure detected. Immediate attention required.',
          details: { Service: data.service, Error: data.error },
          type: 'system_down' // maps to error color
        };
        break;

      case 'system:up':
        emailProps = {
          title: `✅ System Recovered: ${data.service}`,
          message: 'Service is back online.',
          details: { Service: data.service, Downtime: data.downtime },
          type: 'system_up' // maps to success color
        };
        break;

      default:
        logger.warn({ channel }, 'Unknown notification channel');
        return;
    }

    // Generate HTML
    const html = NotificationEmail(emailProps);
    const subject = emailProps.title;
    const text = `${emailProps.title}\n\n${emailProps.message}`; // Fallback text

    // Send
    await emailService.send({ subject, html, text, type: emailProps.type });

  } catch (err) {
    logger.error({ err, channel }, 'Failed to process notification');
  }
}

// --- Main Bootstrap ---
async function main() {
  try {
    // 1. Health Checks
    initHealthMetrics(metrics.register);
    
    // 2. Connect Redis
    await subscriber.connect();
    logger.info('✅ Connected to Redis Pub/Sub');

    // 3. Subscribe to Channels
    const channels = [
      'notifications:suggestions',
      'notifications:backfill',
      'system:alerts',
      'system:bot_restart',
      'system:down',
      'system:up'
    ];
    
    for (const channel of channels) {
      await subscriber.subscribe(channel, (msg) => handleNotification(channel, msg));
    }
    logger.info({ channels }, '🎧 Subscribed to Redis channels');

    // 4. Start HTTP Server (Metrics)
    app.get('/metrics', async (req, res) => {
      res.set('Content-Type', metrics.register.contentType);
      res.end(await metrics.register.metrics());
    });
    
    app.get('/health', (req, res) => res.json({ status: 'UP' }));

    app.listen(config.app.port, () => {
      logger.info({ port: config.app.port }, '📡 Metrics Server listening');
    });

    // 5. Start Kafka Consumer (if needed)
    const kafkaConsumer = new EmailKafkaConsumer({
      logger,
      emailService,
      metrics: {
        notificationsReceived: metrics.notificationsReceived,
        kafkaProcessed: metrics.kafkaProcessed, 
      },
    });
    // await kafkaConsumer.start(); // Uncomment if Kafka strict requirement

    logger.info('🚀 Email Service Started (Modular Architecture)');

  } catch (err) {
    logger.fatal({ err }, '🔥 Fatal Startup Error');
    process.exit(1);
  }
}

// --- Graceful Shutdown ---
process.on('SIGTERM', async () => {
  logger.info('🛑 SIGTERM received. Shutting down...');
  await subscriber.quit();
  process.exit(0);
});

main();
