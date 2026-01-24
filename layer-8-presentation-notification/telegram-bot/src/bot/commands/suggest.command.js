const apiService = require('../../services/api.service');

const handleSuggest = async (ctx) => {
  const text = ctx.message?.text?.replace('/suggest', '').trim();

  if (!text) {
    return ctx.reply(
      '💡 *Submit a Suggestion*\n\n' +
        'Please tell us what you want to improve.\n' +
        'Usage: `/suggest Add Bitcoin support`',
      { parse_mode: 'Markdown' }
    );
  }

  await ctx.sendChatAction('typing');
  const user = ctx.from.username || ctx.from.first_name || 'Anonymous';

  const result = await apiService.submitSuggestion(text, user);

  if (result && result.success) {
    await ctx.reply(`✅ Thanks ${ctx.from.first_name}! Your suggestion has been recorded.`);
  } else {
    await ctx.reply('❌ Failed to save suggestion. Please try again later.');
  }
};

module.exports = {
  handleSuggest,
};
