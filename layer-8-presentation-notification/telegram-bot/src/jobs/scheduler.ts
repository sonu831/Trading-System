const cron = require('node-cron');
const InsightService = require('../services/insight.service');
const logger = require('../core/logger');

const initScheduler = (bot) => {
  const insightService = new InsightService(bot);

  logger.info('⏳ Initializing Cron Jobs...');

  // Schedule: At minute 0 past every hour from 9 through 18 on every day-of-week from Monday through Friday.
  // "0 9-18 * * 1-5"
  cron.schedule('0 9-18 * * 1-5', async () => {
    logger.info('⏰ Cron Triggered: Hourly Insight');
    await insightService.runJob();
  });

  // Test Job (Optional: Runs on startup for dev feedback? No, distracting)
  // But creating a command to force it is useful.

  return insightService;
};

module.exports = { initScheduler };
