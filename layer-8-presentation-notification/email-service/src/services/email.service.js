const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../core/logger');
const metrics = require('../core/metrics');

class EmailService {
  constructor() {
    this.transporter = null;
    this.init();
  }

  init() {
    if (config.email.host && config.email.user && config.email.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
      logger.info({ recipients: config.email.admins.length }, '📧 SMTP Transport Initialized');
    } else {
      logger.warn('⚠️ SMTP Credentials missing. Email Service running in MOCK MODE.');
    }
  }

  /**
   * Send an email using a styled HTML template
   */
  async send({ to, subject, html, text, type = 'notification' }) {
    const recipients = to || config.email.admins;
    const timer = metrics.emailDuration.startTimer({ type });
    
    // Normalize to array
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    if (!recipientList.length) {
      logger.warn('No recipients configured');
      return;
    }

    if (!this.transporter) {
      logger.info({ subject, type }, '📧 [MOCK] Email simulated');
      recipientList.forEach(r => metrics.emailsSent.inc({ recipient: r, type }));
      timer();
      return;
    }

    // Send logic
    for (const recipient of recipientList) {
      try {
        const info = await this.transporter.sendMail({
          from: `"Guru Ji System" <${config.email.from}>`,
          to: recipient,
          subject,
          text: text || 'Please enable HTML view to see this message.',
          html,
        });
        
        logger.info({ msgId: info.messageId, recipient, type }, '✅ Email sent');
        metrics.emailsSent.inc({ recipient, type });
      } catch (err) {
        logger.error({ err, recipient, type }, '❌ Failed to send email');
        metrics.emailsFailed.inc({ recipient, type, error_code: err.code || 'unknown' });
      }
    }
    
    timer();
  }
}

module.exports = new EmailService();
