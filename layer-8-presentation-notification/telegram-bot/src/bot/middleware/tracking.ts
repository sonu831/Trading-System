const logger = require('../../core/logger');
const metrics = require('../../core/metrics');

const trackingMiddleware = async (ctx, next) => {
  const start = Date.now();
  const updateType = ctx.updateType || 'unknown';
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'anonymous';

  // Increment metrics
  metrics.metrics.updatesReceived.inc({ type: updateType });
  if (userId) metrics.metrics.activeUsers.set(1); // Ideally increment a unique counter

  logger.debug({ updateType, userId, username, chatId: ctx.chat?.id }, '📨 Update Received');

  try {
    await next();

    const duration = (Date.now() - start) / 1000;
    logger.debug({ duration }, '✅ Update Processed');
  } catch (err) {
    const duration = (Date.now() - start) / 1000;

    logger.error(
      { err: err.message, stack: err.stack, updateType, duration },
      '❌ Error Processing Update'
    );
    metrics.metrics.botErrors.inc({ type: 'middleware', code: 'exception' });

    // Attempt friendly reply if possible
    if (ctx.chat) {
      ctx.reply('❌ An internal error occurred. Please try again later.').catch(() => {});
    }
  }
};

module.exports = trackingMiddleware;
