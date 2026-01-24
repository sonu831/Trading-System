const { Telegraf, Markup } = require('telegraf');
const config = require('../config');
const logger = require('../core/logger');
const trackingMiddleware = require('./middleware/tracking');

// Command Handlers
const marketCommands = require('./commands/market.command');
const systemCommands = require('./commands/system.command');
const newsCommands = require('./commands/news.command');

const createBot = () => {
  const bot = new Telegraf(config.telegram.token);

  // DEBUG: Intercept Telegram API calls to diagnose "silent" failures
  const originalCallApi = bot.telegram.callApi.bind(bot.telegram);
  bot.telegram.callApi = async function (method, payload, { signal } = {}) {
    const start = Date.now();
    logger.info(
      { method, payload: JSON.stringify(payload).substring(0, 100) },
      '📤 Sending to Telegram API'
    );

    try {
      const response = await originalCallApi(method, payload, { signal });
      const duration = Date.now() - start;
      logger.info({ method, duration, success: true }, '✅ Telegram API Response received');
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error(
        {
          method,
          duration,
          error: error.message,
          code: error.code,
          description: error.description,
        },
        '❌ Telegram API Request FAILED'
      );
      throw error;
    }
  };

  // Middlewares
  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text) {
      console.log(`DEBUG: Incoming Message: "${ctx.message.text}"`);
    }
    return next();
  });
  bot.use(trackingMiddleware);

  // Keyboards
  const mainMenu = Markup.keyboard([
    ['📊 Market Feed', '🚀 Top Gainers', '🩸 Top Losers'],
    ['🏥 System Status', '📰 Market News', '⚡ Live Status'],
    ['📥 Backfill', '🌪 Most Active'],
  ]).resize();

  // Basic Commands
  bot.start((ctx) => {
    ctx.reply(
      `🙏 *Namaste ${ctx.from.first_name}!* I am Guru Ji 🧘‍♂️\n\nYour AI Trading Assistant.`,
      { parse_mode: 'Markdown', ...mainMenu }
    );
  });

  bot.help((ctx) => {
    ctx.reply('Select a command from the menu below.', { parse_mode: 'Markdown', ...mainMenu });
  });

  // Market Handlers (Mapped to both Commands and Text)
  bot.command('feed', marketCommands.handleFeed);
  bot.hears(/Market Feed/i, marketCommands.handleFeed);

  bot.command('high', marketCommands.handleHigh);
  bot.hears(/Top Gainers/i, marketCommands.handleHigh);

  bot.command('low', marketCommands.handleLow);
  bot.hears(/Top Losers/i, marketCommands.handleLow);

  bot.command('movers', marketCommands.handleMovers);
  bot.hears(/Most Active/i, marketCommands.handleMovers);

  // System Handlers
  bot.command('status', systemCommands.handleStatus);
  bot.hears(/System Status/i, systemCommands.handleStatus);

  bot.command('news', newsCommands.handleNews);
  bot.hears(/Market News/i, newsCommands.handleNews);

  bot.command('livestatus', systemCommands.handleLiveStatus);
  bot.hears(/Live Status/i, systemCommands.handleLiveStatus);

  bot.command('backfill', systemCommands.handleBackfill);
  bot.hears(/Backfill/i, systemCommands.handleBackfill);

  const suggestCommands = require('./commands/suggest.command');
  bot.command('suggest', suggestCommands.handleSuggest);

  // Error Handling
  bot.catch((err, ctx) => {
    logger.error({ err, updateType: ctx.updateType }, 'Global Bot Error');
  });

  return bot;
};

module.exports = { createBot };
