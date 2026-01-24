const Markup = require('telegraf/markup');
const axios = require('axios');
const config = require('../../config');
const logger = require('../../core/logger');
const analyzeCommand = require('./analyze.command'); // Reuse existing logic

module.exports = {
  // Show AI Menu
  handleMenu: async (ctx) => {
    return ctx.reply(
      '🧠 *AI Intelligence Center*\nSelect an option:',
      Markup.keyboard([['📉 Market Insights', '🔍 Stock Analysis'], ['🔙 Main Menu']]).resize()
    );
  },

  // Handle Market Insights
  handleMarketInsights: async (ctx) => {
    ctx.reply('🔄 Analyzing Market Sentiment... (Checking 50 Stocks)');

    try {
      const url = `${config.api.analysis}/analyze/market`;
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;

      const reply = `
📉 *Market Insights (AI Powered)*

*Sentiment*: ${data.sentiment === 'Bullish' ? '🟢 Bullish' : data.sentiment === 'Bearish' ? '🔴 Bearish' : '🟡 Neutral'}
*Bullish Stocks*: ${data.bullish}
*Bearish Stocks*: ${data.bearish}
*Total Analyzed*: ${data.total_stocks}

_Based on real-time aggregation of Layer 4 Technicals & AI Scores._
      `;
      ctx.replyWithMarkdown(reply);
    } catch (err) {
      logger.error({ err }, 'Market Insights Failed');
      ctx.reply('❌ Failed to fetch market insights.');
    }
  },

  // Handle Stock Analysis Request (Enter State)
  handleStockAnalysisRequest: async (ctx) => {
    if (!ctx.session) ctx.session = {};
    ctx.session.awaitingStockSymbol = true;

    return ctx.reply(
      '🔍 *Stock Analysis*\n\nPlease type the *Stock Symbol* (e.g., RELIANCE, TCS) to analyze:',
      Markup.inlineKeyboard([Markup.button.callback('Cancel', 'cancel_ai')])
    );
  },

  // Handle Input (Called from middleware/text handler)
  handleStockInput: async (ctx) => {
    if (ctx.session && ctx.session.awaitingStockSymbol) {
      const symbol = ctx.message.text.toUpperCase();

      // Clear state
      ctx.session.awaitingStockSymbol = false;

      // Reuse the analyze command logic
      // We need to mock the structure expected by analyzeCommand (ctx.message.text = "/analyze SYMBOL")
      // Or refactor analyzeCommand to accept symbol directly.
      // For now, I'll manually trigger the logic or just call axios here.

      // Let's just forward to analyzeCommand via text modification? No, hacky.
      // Better: Call a reusable function.
      // I will copy logic or import it.
      // I imported analyzeCommand above. BUT analyzeCommand expects `ctx`.
      // I'll overwrite `ctx.message.text` to `/analyze ${symbol}` and call handle.

      ctx.message.text = `/analyze ${symbol}`;
      return analyzeCommand(ctx);
    }
    return false; // Not handled
  },
};
