const axios = require('axios');
const config = require('../config');
const logger = require('../core/logger');

class InsightService {
  constructor(bot) {
    this.bot = bot;
  }

  /*
   * Main Job Function
   */
  async runJob() {
    logger.info('⏰ Running Hourly Market Insight Job...');

    if (!config.telegram.adminChatId) {
      logger.warn('⚠️ Admin Chat ID not set. Skipping broadcast.');
      return;
    }

    try {
      // 1. Pick a Stock (Smart Strategy)
      const stock = await this.pickStock();
      if (!stock) {
        logger.warn('No stock picked.');
        return;
      }

      logger.info({ symbol: stock.symbol }, '🎯 Selected Stock for Insight');

      // 2. Analyze it
      const analysis = await this.analyzeStock(stock.symbol);
      if (!analysis) return;

      // 3. Broadcast
      await this.broadcast(analysis, stock.reason);
    } catch (error) {
      logger.error({ err: error.message }, 'Insight Job Failed');
    }
  }

  async pickStock() {
    try {
      const url = `${config.api.analysis}/analyze/market`;
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;

      // Use Top Picks from Layer 4 if available
      if (data.top_picks && data.top_picks.length > 0) {
        // Pick the top 1 bullish
        const best = data.top_picks[0];
        return { symbol: best.symbol, reason: `Top Trending (${best.trend})` };
      }

      // Fallback: Random Nifty 50 (if API doesn't return picks yet)
      const fallback = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'SBIN'];
      const random = fallback[Math.floor(Math.random() * fallback.length)];
      return { symbol: random, reason: 'Random Market Check' };
    } catch (error) {
      logger.error({ err: error.message }, 'Failed to fetch market status');
      return null;
    }
  }

  async analyzeStock(symbol) {
    try {
      const url = `${config.api.analysis}/analyze?symbol=${symbol}`;
      // timeout increased for Ollama
      const response = await axios.get(url, { timeout: 45000 });
      return response.data;
    } catch (error) {
      logger.error({ err: error.message, symbol }, 'Failed to analyze stock');
      return null;
    }
  }

  async broadcast(data, reason) {
    const { symbol, ltp, rsi, macd, ai_prediction, ai_confidence, ai_model_version } = data;

    let sentiment = 'Neutral 😐';
    if (ai_prediction > 0.6) sentiment = 'Bullish 🟢';
    if (ai_prediction < 0.4) sentiment = 'Bearish 🔴';

    const message = `
🌟 *Hourly Market Insight* 🌟
_Reason: ${reason}_

📊 *Stock*: *${symbol}*
💰 *Price*: ₹${ltp.toFixed(2)}

🤖 *AI Analysis* (${ai_model_version || 'Heuristic'})
• View: *${sentiment}*
• Score: ${ai_prediction?.toFixed(2)}
• Confidence: ${(ai_confidence * 100).toFixed(0)}%

📈 *Indicators*
• RSI: ${rsi.toFixed(1)}
• MACD: ${macd.histogram > 0 ? 'Positive 🟢' : 'Negative 🔴'}

_Next update in 1 hour..._
`;

    await this.bot.telegram.sendMessage(config.telegram.adminChatId, message, {
      parse_mode: 'Markdown',
    });
    logger.info({ symbol }, '✅ Insight Broadcasted');
  }
}

module.exports = InsightService;
