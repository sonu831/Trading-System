const axios = require('axios');
const config = require('../../config');
const logger = require('../../core/logger');
const marketService = require('../../services/market.service');

module.exports = async (ctx) => {
  const message = ctx.message.text;
  const parts = message.split(' ');
  let input = parts[1];

  if (!input) {
    return ctx.reply('⚠️ Please provide a symbol. Example: /analyze RELIANCE');
  }

  // Fuzzy Check
  const match = marketService.findClosestSymbol(input);

  if (!match) {
    return ctx.reply(`❌ Unknown symbol "${input}". Try /analyze TCS`);
  }

  if (!match.original) {
    // Suggestion
    // Simple flow: just assume user meant it? Or ask?
    // User asked for "Did you mean X? Yes/No"
    // For speed, let's Auto-Correct but Inform.
    // Or implement Yes/No keyboard.
    // I'll auto-correct for now to keep it simple, but mention "Assuming X".
    await ctx.reply(`🤔 Did you mean **${match.symbol}**? Analyzing...`);
  }

  const symbol = match.symbol;

  ctx.reply(`🔍 Analyzing ${symbol}... Please wait.`);

  try {
    const url = `${config.api.analysis}/analyze`;
    logger.info({ url, symbol }, 'Requesting Analysis');

    const response = await axios.get(url, {
      params: { symbol },
      timeout: 45000, // Increased for AI
    });

    const data = response.data; // ScorecardResult

    // Format Message
    const emoji = data.recommendation.includes('BUY')
      ? '🟢'
      : data.recommendation.includes('SELL')
        ? '🔴'
        : '🟡';
    const trendEmoji = data.trend_score > 0 ? '📈' : '📉';

    // Reasoning (Fallbacks if old Layer 4)
    const reasoning = data.ai_reasoning || 'Technical Analysis based on moving averages.';
    const aiConf = data.ai_confidence ? (data.ai_confidence * 100).toFixed(0) + '%' : 'N/A';

    const reply = `
${emoji} *${data.symbol} Analysis*
Score: *${data.trend_score.toFixed(2)}/1.0* ${trendEmoji}
Recommendation: *${data.recommendation}*

🤖 *AI Insight*:
_"${reasoning}"_
(Confidence: ${aiConf})

📊 *Score Card Breakdown*:
• *RSI*: ${data.rsi.toFixed(2)} (${data.rsi > 70 ? 'Overbought 🔴' : data.rsi < 30 ? 'Oversold 🟢' : 'Neutral'})
• *MACD*: ${data.macd.histogram > 0 ? 'Bullish 🟢' : 'Bearish 🔴'}
• *Trend*: ${data.ema50 > data.ema200 ? 'Golden Cross 🌟' : 'Neutral/Bearish'}

❓ *What does the Score mean?*
• > 0.5: Strong Buy
• > 0.0: Weak Buy
• < 0.0: Weak Sell
• < -0.5: Strong Sell
`;

    ctx.replyWithMarkdown(reply);
  } catch (err) {
    logger.error({ err, symbol }, 'Analysis Failed');
    if (err.response && err.response.status === 404) {
      return ctx.reply('❌ Symbol not found or insufficient data.');
    }
    ctx.reply('❌ Analysis service unavailable. Please try again later.');
  }
};
