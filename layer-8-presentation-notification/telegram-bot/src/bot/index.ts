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
  bot.use(require('telegraf').session()); // Enable Session
  bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text) {
      // console.log(\`DEBUG: Incoming Message: "\${ctx.message.text}"\`);
    }
    return next();
  });
  bot.use(trackingMiddleware);

  // Keyboards
  const mainMenu = Markup.keyboard([
    ['brain AI Analysis', '📊 Market Feed'], // Added AI Analysis
    ['🚀 Top Gainers', '🩸 Top Losers'],
    ['🏥 System Status', '📰 Market News'],
    ['⚡ Live Status', '📥 Backfill', '🌪 Most Active'],
  ]).resize();
  // Note: I replaced '📊 Market Feed' slot or added to it.
  // The layout might be 2x3.
  // Let's redefine Main Menu clearly.

  // Custom Menu Handler
  const aiCommands = require('./commands/ai.command');
  bot.hears(/AI Analysis/i, aiCommands.handleMenu);
  bot.hears(/Market Insights/i, aiCommands.handleMarketInsights);
  bot.hears(/Stock Analysis/i, aiCommands.handleStockAnalysisRequest);
  bot.hears(/Main Menu/i, (ctx) =>
    ctx.reply('🔙 Main Menu', { parse_mode: 'Markdown', ...mainMenu })
  );

  // Text Handler for Session (Must be last before commands if possible, or specifically check state)
  bot.on('text', async (ctx, next) => {
    // Check if handling AI input
    const handled = await aiCommands.handleStockInput(ctx);
    if (handled) return; // Stop if handled

    // Check for Menu commands that might match text
    // Telegraf matching logic: hears are checked.
    // This on('text') triggers for everything.
    // We should only intervene if session is active.

    if (ctx.session && ctx.session.awaitingStockSymbol) {
      // Should have been handled by handleStockInput above?
      // Yes.
    }

    return next();
  });

  // Basic Commands
  bot.start((ctx) => {
    ctx.reply(
      `🙏 *Namaste ${ctx.from.first_name}!* I am Guru Ji 🧘‍♂️\n\nYour AI Trading Assistant.`,
      {
        parse_mode: 'Markdown',
        ...Markup.keyboard([
          ['🧠 AI Analysis', '📊 Market Feed'],
          ['🚀 Top Gainers', '🩸 Top Losers'],
          ['🏥 System Status', '📰 Market News'],
          ['⚡ Live Status', '📥 Backfill', '🌪 Most Active'],
        ]).resize(),
      }
    );
  });

  bot.help((ctx) => {
    ctx.reply('Select a command from the menu below.', {
      parse_mode: 'Markdown',
      ...Markup.keyboard([
        ['🧠 AI Analysis', '📊 Market Feed'],
        ['🚀 Top Gainers', '🩸 Top Losers'],
        ['🏥 System Status', '📰 Market News'],
        ['⚡ Live Status', '📥 Backfill', '🌪 Most Active'],
      ]).resize(),
    });
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

  const analyzeCommand = require('./commands/analyze.command');
  bot.command('analyze', analyzeCommand);
  bot.hears(/^analyze/i, analyzeCommand); // Handles "Analyze RELIANCE" or "/analyze RELIANCE" via text regex if slash missing

  bot.command('livestatus', systemCommands.handleLiveStatus);
  bot.hears(/Live Status/i, systemCommands.handleLiveStatus);

  bot.command('backfill', systemCommands.handleBackfill);
  bot.hears(/Backfill/i, systemCommands.handleBackfill);

  const suggestCommands = require('./commands/suggest.command');
  bot.command('suggest', suggestCommands.handleSuggest);

  // Error Handling
  // Error Handling
  bot.catch((err, ctx) => {
    logger.error({ err, updateType: ctx.updateType }, 'Global Bot Error');
  });

  // Initialize Background Jobs
  const { initScheduler } = require('../jobs/scheduler');
  const scheduler = initScheduler(bot);

  // Dev Command to Test Job
  bot.command('testjob', async (ctx) => {
    if (ctx.from.id.toString() !== config.telegram.adminChatId) return; // Secure?
    ctx.reply('⏳ Running Insight Job manually...');
    await scheduler.runJob();
    ctx.reply('✅ Job Done.');
  });

  return bot;
};

module.exports = { createBot };
