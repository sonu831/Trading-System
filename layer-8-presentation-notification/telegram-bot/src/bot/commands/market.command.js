const marketService = require('../../services/market.service');

// Shared Handler Logic
const handleFeed = async (ctx) => {
  await ctx.sendChatAction('typing');
  const market = await marketService.getMarketSnapshot();

  if (!market || !market.breadth) {
    return ctx.reply('📉 Market data unavailable (Partial). Please try again later.', {
      parse_mode: 'Markdown',
    });
  }

  const { breadth } = market;
  const msg =
    `📊 *Market Snapshot* (${new Date().toLocaleTimeString()})\n\n` +
    `📈 *Sentiment*: ${breadth.market_sentiment || 'Neutral'}\n` +
    `🟢 *Advance*: ${breadth.advance_count || 0}\n` +
    `🔴 *Decline*: ${breadth.decline_count || 0}\n` +
    `⚖️ *A/D Ratio*: ${(breadth.advance_decline || 0).toFixed(2)}`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
};

const handleHigh = async (ctx) => {
  console.log('DEBUG: handleHigh - START');
  await ctx.sendChatAction('typing');
  const gainers = await marketService.getTopGainers(10);

  if (gainers.length === 0) {
    console.log('DEBUG: handleHigh - No data');
    return ctx.reply('📉 Market data unavailable.', { parse_mode: 'Markdown' });
  }

  const list = gainers.map(marketService.formatStock).join('\n');
  console.log('DEBUG: handleHigh - Sending reply...');
  try {
    const res = await ctx.reply(`🚀 *Top Gainers*\n\n${list}`, { parse_mode: 'Markdown' });
    console.log('DEBUG: handleHigh - Reply SUCCESS', res ? 'OK' : 'NULL');
  } catch (err) {
    console.error('DEBUG: handleHigh - Reply FAILED', err);
  }
};

const handleLow = async (ctx) => {
  console.log('DEBUG: handleLow - START');
  await ctx.sendChatAction('typing');
  const losers = await marketService.getTopLosers(10);

  if (losers.length === 0) {
    console.log('DEBUG: handleLow - No data');
    return ctx.reply('📉 Market data unavailable.', { parse_mode: 'Markdown' });
  }

  const list = losers.map(marketService.formatStock).join('\n');
  console.log('DEBUG: handleLow - Sending reply...');
  try {
    const res = await ctx.reply(`🩸 *Top Losers*\n\n${list}`, { parse_mode: 'Markdown' });
    console.log('DEBUG: handleLow - Reply SUCCESS', res ? 'OK' : 'NULL');
  } catch (err) {
    console.error('DEBUG: handleLow - Reply FAILED', err);
  }
};

const handleMovers = async (ctx) => {
  await ctx.sendChatAction('typing');
  const movers = await marketService.getMostActive(10);

  if (movers.length === 0) {
    return ctx.reply('📉 Market data unavailable.', { parse_mode: 'Markdown' });
  }

  const list = movers.map(marketService.formatStock).join('\n');
  await ctx.reply(`🌪 *Most Active*\n\n${list}`, { parse_mode: 'Markdown' });
};

module.exports = {
  handleFeed,
  handleHigh,
  handleLow,
  handleMovers,
};
