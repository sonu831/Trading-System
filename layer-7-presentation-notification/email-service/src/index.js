const { createClient } = require('redis');
const nodemailer = require('nodemailer');
const pino = require('pino');

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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const SYSTEM_EMAIL = process.env.SYSTEM_EMAIL || 'system@stocks-guru.com';

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
  logger.info({ host: SMTP_HOST }, '📧 Email Service Configured');
} else {
  logger.warn('⚠️ SMTP Credentials missing. Email Service running in MOCK MODE (logging only).');
}

async function sendEmail(subject, text, html) {
  if (!transporter) {
    logger.info({ subject, recipient: ADMIN_EMAIL }, '📧 [MOCK] Email would be sent');
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Guru Ji System" <${SYSTEM_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: subject,
      text: text,
      html: html || text,
    });
    logger.info({ msgId: info.messageId }, '✅ Email sent');
  } catch (err) {
    logger.error({ err }, '❌ Failed to send email');
  }
}

async function main() {
  try {
    subscriber.on('error', (err) => logger.error({ err }, 'Redis Error'));
    await subscriber.connect();
    logger.info('✅ Connected to Redis Pub/Sub');

    // Subscribe: Suggestions
    await subscriber.subscribe('notifications:suggestions', (message) => {
      try {
        const data = JSON.parse(message);
        const subject = `💡 New Suggestion from ${data.user}`;
        const body = `User: ${data.user}\nMessage: ${data.text}\nSource: ${data.source}`;
        const html = `
          <h3>💡 New User Suggestion</h3>
          <p><strong>User:</strong> ${data.user}</p>
          <p><strong>Message:</strong> ${data.text}</p>
          <p><em>Source: ${data.source}</em></p>
        `;
        sendEmail(subject, body, html);
      } catch {
        logger.error('Invalid suggestion msg');
      }
    });

    // Subscribe: Backfill Completion
    await subscriber.subscribe('notifications:backfill', (message) => {
      try {
        const data = JSON.parse(message);
        const subject = `📥 Backfill Complete: ${data.symbol}`;
        const body = JSON.stringify(data, null, 2);
        sendEmail(subject, body, `<pre>${body}</pre>`);
      } catch {
        logger.error('Invalid backfill msg');
      }
    });

    // Subscribe: Critical System Alerts
    await subscriber.subscribe('system:alerts', (message) => {
      sendEmail('🚨 System Alert', message);
    });

    logger.info('🎧 Listening for notification events...');
  } catch (err) {
    logger.error({ err }, 'Fatal Error');
    process.exit(1);
  }
}

main();
