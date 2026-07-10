const apiService = require('../../services/api.service');

const handleNews = async (ctx) => {
  console.log('DEBUG: handleNews - START');
  await ctx.sendChatAction('typing');

  console.log('DEBUG: handleNews - Fetching news...');
  const result = await apiService.getNews();
  console.log('DEBUG: handleNews - Result count:', result?.data?.length || 0);

  if (!result || !result.success || !result.data || result.data.length === 0) {
    return ctx.reply('📰 No latest news available.', { parse_mode: 'Markdown' });
  }

  // Format news
  const newsItems = result.data
    .map((n) => {
      const sentimentIcon =
        n.sentiment === 'positive' ? '🟢' : n.sentiment === 'negative' ? '🔴' : '⚪';
      return `${sentimentIcon} *${n.headline}*\n   _${n.source} • ${n.time}_`;
    })
    .join('\n\n');

  const msg = `📰 *Latest Market News*\n\n${newsItems}`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
};

module.exports = {
  handleNews,
};
