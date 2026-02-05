const { createClient } = require('redis');
const nodemailer = require('nodemailer');
const pino = require('pino');
const express = require('express');
const promClient = require('prom-client');
const { EmailKafkaConsumer } = require('./kafka-consumer');

// Express App for /metrics
const app = express();
const PORT = process.env.PORT || 7001;

// Prometheus Registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'email_service_' });

// ============================================================================
// PROMETHEUS METRICS
// ============================================================================

// Total emails sent (successful)
const emailsSentTotal = new promClient.Counter({
  name: 'email_sent_total',
  help: 'Total emails successfully sent',
  labelNames: ['recipient', 'type'],
});
register.registerMetric(emailsSentTotal);

// Total emails failed
const emailsFailedTotal = new promClient.Counter({
  name: 'email_failed_total',
  help: 'Total emails that failed to send',
  labelNames: ['recipient', 'type', 'error_code'],
});
register.registerMetric(emailsFailedTotal);

// Email processing time
const emailDuration = new promClient.Histogram({
  name: 'email_send_duration_seconds',
  help: 'Time taken to send emails',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});
register.registerMetric(emailDuration);

// Current recipient count
const recipientCount = new promClient.Gauge({
  name: 'email_recipients_configured',
  help: 'Number of configured admin email recipients',
});
register.registerMetric(recipientCount);

// Notifications received by channel
const notificationsReceived = new promClient.Counter({
  name: 'email_notifications_received_total',
  help: 'Total notifications received from Redis channels',
  labelNames: ['channel'],
});
register.registerMetric(notificationsReceived);

// Kafka Notifications Processed
const kafkaNotificationsProcessed = new promClient.Counter({
  name: 'kafka_notifications_processed_total',
  help: 'Total Kafka notifications processed by status',
  labelNames: ['type', 'status'], // status: success, failed, retried, dlq
});
register.registerMetric(kafkaNotificationsProcessed);

// Logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
});

// Config
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
// Support multiple admin emails (comma-separated)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@example.com')
  .split(',')
  .map((email) => email.trim())
  .filter((email) => email.length > 0);
const SYSTEM_EMAIL = process.env.SYSTEM_EMAIL || 'system@stocks-guru.com';

// Update recipient count metric
recipientCount.set(ADMIN_EMAILS.length);

// Redis
const subscriber = createClient({ url: REDIS_URL });

// Mailer
let transporter = null;

if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });
  logger.info({ host: SMTP_HOST, recipients: ADMIN_EMAILS.length }, '📧 Email Service Configured');
} else {
  logger.warn('⚠️ SMTP Credentials missing. Email Service running in MOCK MODE (logging only).');
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 * All user-controlled data MUST be passed through this before HTML interpolation.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function sendEmail(subject, text, html, emailType = 'notification') {
  const end = emailDuration.startTimer({ type: emailType });

  if (!transporter) {
    logger.info({ subject, recipients: ADMIN_EMAILS }, '📧 [MOCK] Email would be sent');
    // Still count as "sent" in mock mode for testing
    ADMIN_EMAILS.forEach((r) => emailsSentTotal.inc({ recipient: r, type: emailType }));
    end();
    return;
  }

  // Send to all admin emails
  for (const recipient of ADMIN_EMAILS) {
    try {
      const info = await transporter.sendMail({
        from: `"Guru Ji System" <${SYSTEM_EMAIL}>`,
        to: recipient,
        subject: subject,
        text: text,
        html: html || text,
      });
      logger.info({ msgId: info.messageId, recipient }, '✅ Email sent');
      emailsSentTotal.inc({ recipient, type: emailType });
    } catch (err) {
      logger.error({ err, recipient }, '❌ Failed to send email');
      emailsFailedTotal.inc({ recipient, type: emailType, error_code: err.code || 'unknown' });
    }
  }
  end();
}

const { waitForAll, initHealthMetrics } = require('/app/shared/health-check');

async function main() {
  try {
    // Wait for Infrastructure
    initHealthMetrics(register);

    const kafkaBrokers = (process.env.KAFKA_BROKERS || 'kafka:29092').split(',');
    const notificationTopic = process.env.KAFKA_NOTIFICATION_TOPIC || 'notifications';
    
    await waitForAll({
      redis: { url: REDIS_URL },
      kafka: { brokers: kafkaBrokers, topic: notificationTopic }
    }, { logger });

    subscriber.on('error', (err) => logger.error({ err }, 'Redis Error'));
    await subscriber.connect();
    logger.info('✅ Connected to Redis Pub/Sub');

    // Subscribe: Suggestions
    await subscriber.subscribe('notifications:suggestions', (message) => {
      notificationsReceived.inc({ channel: 'suggestions' });
      try {
        const data = JSON.parse(message);
        const subject = `💡 New Suggestion from ${data.user}`;
        const body = `User: ${data.user}\nMessage: ${data.text}\nSource: ${data.source}`;
        const html = `
          <h3>💡 New User Suggestion</h3>
          <p><strong>User:</strong> ${escapeHtml(data.user)}</p>
          <p><strong>Message:</strong> ${escapeHtml(data.text)}</p>
          <p><em>Source: ${escapeHtml(data.source)}</em></p>
        `;
        sendEmail(subject, body, html, 'suggestion');
      } catch {
        logger.error('Invalid suggestion msg');
      }
    });

    // Subscribe: Backfill Completion
    await subscriber.subscribe('notifications:backfill', (message) => {
      notificationsReceived.inc({ channel: 'backfill' });
      try {
        const data = JSON.parse(message);
        const subject = `📥 Backfill Complete: ${data.symbol}`;
        const body = JSON.stringify(data, null, 2);
        sendEmail(subject, body, `<pre>${body}</pre>`, 'backfill');
      } catch {
        logger.error('Invalid backfill msg');
      }
    });

    // Subscribe: Critical System Alerts
    await subscriber.subscribe('system:alerts', (message) => {
      notificationsReceived.inc({ channel: 'system_alerts' });
      sendEmail('🚨 System Alert', message, null, 'alert');
    });

    // Subscribe: Bot Restart Notification
    await subscriber.subscribe('system:bot_restart', (message) => {
      notificationsReceived.inc({ channel: 'bot_restart' });
      try {
        const data = JSON.parse(message);
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const subject = `🔄 Bot Restarted - ${data.botName || 'Trading System'}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #667eea; margin-bottom: 20px;">🔄 Bot Restarted Successfully!</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Bot Name:</strong></td>
                  <td style="padding: 12px 0;">${escapeHtml(data.botName || 'Guru Ji Trading Bot')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Instance ID:</strong></td>
                  <td style="padding: 12px 0; font-family: monospace;">${escapeHtml(data.instanceId || 'N/A')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Hostname:</strong></td>
                  <td style="padding: 12px 0;">${escapeHtml(data.hostname || 'Unknown')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Restart Time:</strong></td>
                  <td style="padding: 12px 0;">${timestamp}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #666;"><strong>Status:</strong></td>
                  <td style="padding: 12px 0;"><span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 4px;">🟢 ONLINE</span></td>
                </tr>
              </table>
              <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 6px; text-align: center;">
                <p style="margin: 0; color: #666;">🙏 <em>Thank you for using Guru Ji Trading System!</em></p>
                <p style="margin: 10px 0 0 0; color: #888; font-size: 12px;">All systems are operational.</p>
              </div>
            </div>
          </div>
        `;
        const text = `Bot Restarted: ${data.botName || 'Trading Bot'}\nTime: ${timestamp}\nInstance: ${data.instanceId}\nStatus: ONLINE`;
        sendEmail(subject, text, html, 'bot_restart');
      } catch {
        logger.error('Invalid bot restart msg');
      }
    });

    // Subscribe: System Down Notification
    await subscriber.subscribe('system:down', (message) => {
      notificationsReceived.inc({ channel: 'system_down' });
      try {
        const data = JSON.parse(message);
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const subject = `🚨 CRITICAL: System Down - ${data.service || 'Trading System'}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%); border-radius: 10px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #dc3545; margin-bottom: 20px;">🚨 System Down Alert!</h2>
              <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                <strong>⚠️ Immediate attention required!</strong>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Service:</strong></td>
                  <td style="padding: 12px 0;">${escapeHtml(data.service || 'Unknown Service')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Error:</strong></td>
                  <td style="padding: 12px 0; color: #dc3545;">${escapeHtml(data.error || 'Connection Lost')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Time Detected:</strong></td>
                  <td style="padding: 12px 0;">${timestamp}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #666;"><strong>Status:</strong></td>
                  <td style="padding: 12px 0;"><span style="background: #dc3545; color: white; padding: 4px 12px; border-radius: 4px;">🔴 DOWN</span></td>
                </tr>
              </table>
              ${data.details ? `<pre style="background: #f8f9fa; padding: 15px; border-radius: 6px; overflow-x: auto; margin-top: 20px;">${escapeHtml(JSON.stringify(data.details, null, 2))}</pre>` : ''}
              <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 6px; text-align: center;">
                <p style="margin: 0; color: #666;">🙏 <em>Thank you for your prompt attention!</em></p>
                <p style="margin: 10px 0 0 0; color: #888; font-size: 12px;">Please investigate and restore the service.</p>
              </div>
            </div>
          </div>
        `;
        const text = `CRITICAL: System Down\nService: ${data.service}\nError: ${data.error}\nTime: ${timestamp}`;
        sendEmail(subject, text, html, 'system_down');
      } catch {
        logger.error('Invalid system down msg');
      }
    });

    // Subscribe: System Recovered/Up Notification
    await subscriber.subscribe('system:up', (message) => {
      notificationsReceived.inc({ channel: 'system_up' });
      try {
        const data = JSON.parse(message);
        const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        const downtime = data.downtime || 'Unknown';
        const subject = `✅ System Recovered - ${data.service || 'Trading System'}`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); border-radius: 10px;">
            <div style="background: white; padding: 30px; border-radius: 8px;">
              <h2 style="color: #28a745; margin-bottom: 20px;">✅ System Recovered!</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Service:</strong></td>
                  <td style="padding: 12px 0;">${escapeHtml(data.service || 'Trading System')}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Recovery Time:</strong></td>
                  <td style="padding: 12px 0;">${timestamp}</td>
                </tr>
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 12px 0; color: #666;"><strong>Total Downtime:</strong></td>
                  <td style="padding: 12px 0;">${escapeHtml(downtime)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; color: #666;"><strong>Status:</strong></td>
                  <td style="padding: 12px 0;"><span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 4px;">🟢 ONLINE</span></td>
                </tr>
              </table>
              <div style="margin-top: 25px; padding: 15px; background: #d4edda; border: 1px solid #28a745; border-radius: 6px; text-align: center;">
                <p style="margin: 0; color: #155724;"><strong>🎉 All systems are back online!</strong></p>
              </div>
              <div style="margin-top: 15px; text-align: center;">
                <p style="margin: 0; color: #666;">🙏 <em>Thank you for your patience!</em></p>
              </div>
            </div>
          </div>
        `;
        const text = `System Recovered: ${data.service}\nRecovery Time: ${timestamp}\nDowntime: ${downtime}\nStatus: ONLINE`;
        sendEmail(subject, text, html, 'system_up');
      } catch {
        logger.error('Invalid system up msg');
      }
    });

    logger.info(
      {
        channels: ['suggestions', 'backfill', 'alerts', 'bot_restart', 'system:down', 'system:up'],
      },
      '🎧 Listening for notification events...'
    );

    // HTTP Server for /metrics
    app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
      } catch (err) {
        res.status(500).end(err.message);
      }
    });

    app.get('/health', (req, res) => {
      res.json({
        status: 'UP',
        recipients: ADMIN_EMAILS.length,
        timestamp: new Date().toISOString(),
      });
    });

    app.listen(PORT, () => {
      logger.info({ port: PORT }, `📡 HTTP Server listening on port ${PORT} (Metrics: /metrics)`);
    });

    // Start Kafka Consumer (dual-mode: Redis Pub/Sub + Kafka)
    const kafkaConsumer = new EmailKafkaConsumer({
      logger,
      sendEmail,
      metrics: {
        notificationsReceived,
        kafkaProcessed: kafkaNotificationsProcessed,
      },
    });
    await kafkaConsumer.start();
    logger.info('🚀 Email Service started (Redis + Kafka dual-mode)');
  } catch (err) {
    logger.error({ err }, 'Fatal Error');
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down Email Service...');
  try {
    if (subscriber) await subscriber.quit();
  } catch (err) {
    logger.error({ err }, 'Shutdown error');
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main();
