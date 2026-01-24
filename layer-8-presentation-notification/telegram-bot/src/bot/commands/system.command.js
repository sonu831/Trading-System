const backfillService = require('../../services/backfill.service');
const logger = require('../../core/logger');

const apiService = require('../../services/api.service');

const handleStatus = async (ctx) => {
  console.log('DEBUG: handleStatus - START');
  await ctx.sendChatAction('typing');
  console.log('DEBUG: handleStatus - Fetching health...');
  const health = await apiService.getSystemHealth();
  console.log('DEBUG: handleStatus - Health result:', health ? 'OK' : 'NULL');

  let statusMsg = '';
  if (!health) {
    statusMsg =
      `🏥 *System Health Report*\n\n` +
      `❌ *Backend API*: Unreachable\n` +
      `✅ *Bot*: Online\n\n` +
      `_Critical Error: Cannot contact backend_`;
  } else {
    // Dynamic Component Rendering
    const componentsList = Object.entries(health.components)
      .filter(([key]) => key !== 'ingestion_details') // Exclude details object
      .map(([key, status]) => {
        let icon = '🔴';
        if (status === 'UP') icon = '✅';
        if (status === 'STALE') icon = '⚠️';
        if (status === 'UNKNOWN') icon = '❓';

        // Capitalize Key (e.g., 'redis' -> 'Redis')
        const label = key.charAt(0).toUpperCase() + key.slice(1);
        return `${icon} *${label}*: ${status}`;
      })
      .join('\n');

    statusMsg =
      `🏥 *System Health Report*\n\n` +
      `✅ *Bot*: Online\n` +
      `✅ *Backend API*: Online\n` +
      `${componentsList}\n` +
      `\n⏱ *Uptime*: ${Math.floor(health.uptime)}s` +
      `\n_Time: ${new Date().toLocaleTimeString()}_`;
  }

  await ctx.reply(statusMsg, { parse_mode: 'Markdown' });
};

const handleLiveStatus = async (ctx) => {
  await ctx.sendChatAction('typing');
  const health = await apiService.getSystemHealth();

  if (!health || !health.components.ingestion_details) {
    return ctx.reply('⚠️ *Live Status Unavailable*\n\nNo market data stream detected.', {
      parse_mode: 'Markdown',
    });
  }

  const details = health.components.ingestion_details;
  const lastUpdate = new Date(details.timestamp).toLocaleTimeString();
  const ticks = details.websocket_packets || '0';

  // Heuristic: If packets > 0 and timestamp < 1min ago, Stream is Active
  const isActive = health.components.ingestion === 'UP';
  const statusIcon = isActive ? '🟢' : '🔴';

  const msg =
    `⚡ *Live Market Status*\n\n` +
    `${statusIcon} *Stream*: ${isActive ? 'Active' : 'Idle/Disconnected'}\n` +
    `📊 *Ticks*: ${ticks}\n` +
    `💾 *Heap*: ${details.heap_used}\n` +
    `🕒 *Last Update*: ${lastUpdate}\n` +
    `\n_Source: MStock Stream_`;

  await ctx.reply(msg, { parse_mode: 'Markdown' });
};

const handleBackfill = async (ctx) => {
  const args = ctx.message?.text?.replace('/backfill', '').trim() || '';
  const { days, interval } = backfillService.parseArgs(args);

  try {
    const result = await backfillService.triggerBackfill({ days, interval });

    const msg =
      `⚡ *Backfill Job Started*\n\n` +
      `📊 *Job ID*: \`${result.jobId}\`\n` +
      `📅 *Range*: ${result.fromStr} to ${result.toStr}\n` +
      `⏱ *Interval*: ${result.interval}\n` +
      `\n_You can track progress with /livestatus_`;

    await ctx.reply(msg, { parse_mode: 'Markdown' });
  } catch (err) {
    await ctx.reply('❌ Failed to trigger backfill.');
  }
};

module.exports = {
  handleStatus,
  handleBackfill,
  handleLiveStatus,
};
