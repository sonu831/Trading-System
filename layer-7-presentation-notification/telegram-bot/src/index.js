const express = require('express');
const client = require('prom-client');
const { Telegraf } = require('telegraf');
const { createClient } = require('redis');
const pino = require('pino');
const os = require('os');
const crypto = require('crypto');

// Generate unique instance ID for debugging multiple instances
const INSTANCE_ID = crypto.randomBytes(4).toString('hex');
const HOSTNAME = os.hostname();
const START_TIME = new Date().toISOString();

// Logger with instance context
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true },
  },
  base: {
    instanceId: INSTANCE_ID,
    hostname: HOSTNAME,
  },
});

logger.info(
  {
    event: 'BOT_STARTING',
    instanceId: INSTANCE_ID,
    hostname: HOSTNAME,
    startTime: START_TIME,
    nodeVersion: process.version,
    platform: process.platform,
  },
  '🚀 Telegram Bot Instance Starting...'
);

const app = express();
const port = process.env.PORT || 7000;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

// Prometheus Registry
const register = new client.Registry();
client.collectDefaultMetrics({ register });

// ============================================================================
// COMPREHENSIVE PROMETHEUS METRICS
// ============================================================================

// --- INBOUND METRICS ---

// All updates received (raw Telegram updates)
const updatesReceived = new client.Counter({
  name: 'telegram_updates_received_total',
  help: 'Total Telegram updates received',
  labelNames: ['type'], // message, callback_query, inline_query, etc.
});
register.registerMetric(updatesReceived);

// Commands received
const commandsReceived = new client.Counter({
  name: 'telegram_commands_received_total',
  help: 'Total commands received from users',
  labelNames: ['command', 'username'],
});
register.registerMetric(commandsReceived);

// Messages by type
const messagesReceived = new client.Counter({
  name: 'telegram_messages_received_total',
  help: 'Total messages received by type',
  labelNames: ['type', 'chat_type'], // type: text, photo, sticker; chat_type: private, group
});
register.registerMetric(messagesReceived);

// Unique users (active today)
const uniqueUsers = new client.Gauge({
  name: 'telegram_unique_users_today',
  help: 'Unique users who interacted today',
});
register.registerMetric(uniqueUsers);

// --- OUTBOUND METRICS ---

// Notifications/messages sent
const messagesSent = new client.Counter({
  name: 'telegram_messages_sent_total',
  help: 'Total messages sent by bot',
  labelNames: ['type', 'status'], // type: reply, broadcast, notification; status: success, failed
});
register.registerMetric(messagesSent);

// Broadcasts
const broadcastsSent = new client.Counter({
  name: 'telegram_broadcasts_sent_total',
  help: 'Total broadcast operations',
  labelNames: ['trigger'], // signal, backfill, scheduled, manual
});
register.registerMetric(broadcastsSent);

// Broadcast recipients
const broadcastRecipients = new client.Gauge({
  name: 'telegram_broadcast_recipients',
  help: 'Number of recipients in last broadcast',
});
register.registerMetric(broadcastRecipients);

// --- PERFORMANCE METRICS ---

// Command latency
const commandLatency = new client.Histogram({
  name: 'telegram_command_duration_seconds',
  help: 'Command processing duration',
  labelNames: ['command'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
register.registerMetric(commandLatency);

// API call latency (to backend-api)
const apiCallLatency = new client.Histogram({
  name: 'telegram_api_call_duration_seconds',
  help: 'External API call duration',
  labelNames: ['endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});
register.registerMetric(apiCallLatency);

// --- ERROR METRICS ---

const botErrors = new client.Counter({
  name: 'telegram_bot_errors_total',
  help: 'Total bot errors by type',
  labelNames: ['type', 'code'], // type: api, redis, telegram; code: error code
});
register.registerMetric(botErrors);

// --- SUBSCRIBER METRICS ---

const subscriberCount = new client.Gauge({
  name: 'telegram_subscribers_total',
  help: 'Total number of subscribers',
});
register.registerMetric(subscriberCount);

// ============================================================================
// USER TRACKING (In-memory for today's activity)
// ============================================================================

const todayUsers = new Set();
const userActivity = new Map(); // userId -> { lastSeen, commands: [], messageCount }

function trackUser(ctx) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || 'anonymous';

  if (!userId) return;

  todayUsers.add(userId);
  uniqueUsers.set(todayUsers.size);

  if (!userActivity.has(userId)) {
    userActivity.set(userId, {
      username,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      commands: [],
      messageCount: 0,
    });
  }

  const activity = userActivity.get(userId);
  activity.lastSeen = new Date().toISOString();
  activity.messageCount++;
}

// Reset daily users at midnight
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    logger.info({ previousCount: todayUsers.size }, '🔄 Resetting daily user count');
    todayUsers.clear();
    userActivity.clear();
    uniqueUsers.set(0);
  }
}, 60000); // Check every minute

// ============================================================================
// MIDDLEWARE: Track ALL incoming updates
// ============================================================================

const trackingMiddleware = async (ctx, next) => {
  const start = Date.now();
  const updateType = ctx.updateType || 'unknown';
  const chatType = ctx.chat?.type || 'private';
  const userId = ctx.from?.id;
  const firstName = ctx.from?.first_name || 'User';
  const username = ctx.from?.username || null;
  const displayName = username ? `@${username}` : firstName;

  // Track update
  updatesReceived.inc({ type: updateType });
  trackUser(ctx);

  // Detailed logging
  logger.info(
    {
      event: 'UPDATE_RECEIVED',
      updateType,
      chatType,
      userId,
      firstName,
      username,
      displayName,
      chatId: ctx.chat?.id,
      messageText: ctx.message?.text?.substring(0, 50), // First 50 chars only
      instanceId: INSTANCE_ID,
    },
    `📨 Update: ${updateType} from ${displayName}`
  );

  try {
    await next();

    const duration = (Date.now() - start) / 1000;
    logger.info(
      {
        event: 'UPDATE_PROCESSED',
        updateType,
        userId,
        duration,
        instanceId: INSTANCE_ID,
      },
      `✅ Processed in ${duration.toFixed(3)}s`
    );
  } catch (err) {
    botErrors.inc({ type: 'middleware', code: err.code || 'unknown' });
    logger.error(
      {
        event: 'UPDATE_ERROR',
        updateType,
        userId,
        error: err.message,
        instanceId: INSTANCE_ID,
      },
      '❌ Error processing update'
    );
    throw err;
  }
};

// ============================================================================
// HELPER: Track command execution with full details
// ============================================================================

const trackCommand = (command, fn) => async (ctx) => {
  const start = Date.now();
  const username = ctx.from?.username || 'anonymous';
  const userId = ctx.from?.id;

  // Increment metrics
  commandsReceived.inc({ command, username });
  messagesReceived.inc({ type: 'command', chat_type: ctx.chat?.type || 'private' });

  // Track in user activity
  if (userActivity.has(userId)) {
    userActivity.get(userId).commands.push({
      command,
      timestamp: new Date().toISOString(),
    });
  }

  logger.info(
    {
      event: 'COMMAND_START',
      command,
      userId,
      username,
      chatId: ctx.chat?.id,
      args: ctx.message?.text?.replace(`/${command}`, '').trim() || null,
      instanceId: INSTANCE_ID,
    },
    `🎯 /${command} from @${username}`
  );

  try {
    await fn(ctx);

    const duration = (Date.now() - start) / 1000;
    commandLatency.observe({ command }, duration);
    messagesSent.inc({ type: 'reply', status: 'success' });

    logger.info(
      {
        event: 'COMMAND_SUCCESS',
        command,
        userId,
        duration,
        instanceId: INSTANCE_ID,
      },
      `✅ /${command} completed in ${duration.toFixed(3)}s`
    );
  } catch (err) {
    botErrors.inc({ type: 'command_error', code: err.code || 'unknown' });
    messagesSent.inc({ type: 'reply', status: 'failed' });

    logger.error(
      {
        event: 'COMMAND_ERROR',
        command,
        userId,
        error: err.message,
        instanceId: INSTANCE_ID,
      },
      `❌ /${command} failed`
    );
    throw err;
  }
};

// ============================================================================
// HELPER: Track broadcast with full details
// ============================================================================

const trackBroadcast = async (trigger, messagePreview, sendFn) => {
  const start = Date.now();

  logger.info(
    {
      event: 'BROADCAST_START',
      trigger,
      messagePreview: messagePreview.substring(0, 100),
      instanceId: INSTANCE_ID,
    },
    `📢 Starting broadcast (${trigger})`
  );

  broadcastsSent.inc({ trigger });

  try {
    const { sent, failed, total } = await sendFn();

    const duration = (Date.now() - start) / 1000;
    broadcastRecipients.set(total);
    messagesSent.inc({ type: 'broadcast', status: 'success' }, sent);
    messagesSent.inc({ type: 'broadcast', status: 'failed' }, failed);

    logger.info(
      {
        event: 'BROADCAST_COMPLETE',
        trigger,
        sent,
        failed,
        total,
        duration,
        instanceId: INSTANCE_ID,
      },
      `📢 Broadcast complete: ${sent}/${total} delivered`
    );

    return { sent, failed, total };
  } catch (err) {
    botErrors.inc({ type: 'broadcast_error', code: 'unknown' });
    logger.error(
      {
        event: 'BROADCAST_ERROR',
        trigger,
        error: err.message,
        instanceId: INSTANCE_ID,
      },
      '❌ Broadcast failed'
    );
    throw err;
  }
};
// ============================================================================
// MARKET HOURS DETECTION (NSE Trading Hours)
// ============================================================================

const MARKET_OPEN_HOUR = 9; // 9:15 AM IST
const MARKET_OPEN_MINUTE = 15;
const MARKET_CLOSE_HOUR = 15; // 3:30 PM IST
const MARKET_CLOSE_MINUTE = 30;

function isMarketOpen() {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const day = istTime.getUTCDay(); // 0 = Sunday, 6 = Saturday
  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();

  // Check if weekend
  if (day === 0 || day === 6) {
    return { open: false, reason: 'weekend', message: '📅 Market is closed (Weekend)' };
  }

  // Check market hours
  const currentMinutes = hours * 60 + minutes;
  const openMinutes = MARKET_OPEN_HOUR * 60 + MARKET_OPEN_MINUTE; // 9:15 = 555
  const closeMinutes = MARKET_CLOSE_HOUR * 60 + MARKET_CLOSE_MINUTE; // 15:30 = 930

  if (currentMinutes < openMinutes) {
    return {
      open: false,
      reason: 'pre_market',
      message: `⏰ Market opens at 9:15 AM IST\n_Pre-market session - live data unavailable_`,
    };
  }

  if (currentMinutes > closeMinutes) {
    return {
      open: false,
      reason: 'post_market',
      message: `🌙 Market closed at 3:30 PM IST\n_Showing last available data from today_`,
    };
  }

  return { open: true, reason: 'trading', message: null };
}

function getMarketStatusMessage() {
  const status = isMarketOpen();
  if (status.open) {
    return '🟢 *Market is OPEN*\n_Live trading in progress_';
  }
  return status.message;
}

// Initialize Redis
const subscriber = createClient({ url: REDIS_URL });
const publisher = createClient({ url: REDIS_URL });

subscriber.on('error', (err) =>
  logger.error({ err, instanceId: INSTANCE_ID }, 'Redis Subscriber Error')
);
subscriber.on('connect', () =>
  logger.info({ instanceId: INSTANCE_ID }, 'Redis Subscriber Connected')
);
subscriber.on('ready', () => logger.info({ instanceId: INSTANCE_ID }, 'Redis Subscriber Ready'));

publisher.on('error', (err) =>
  logger.error({ err, instanceId: INSTANCE_ID }, 'Redis Publisher Error')
);
publisher.on('connect', () =>
  logger.info({ instanceId: INSTANCE_ID }, 'Redis Publisher Connected')
);
publisher.on('ready', () => logger.info({ instanceId: INSTANCE_ID }, 'Redis Publisher Ready'));

// Initialize Bot
if (!BOT_TOKEN) {
  logger.error({ instanceId: INSTANCE_ID }, 'TELEGRAM_BOT_TOKEN is missing. Bot will not start.');
  process.exit(1);
}

// Mask token for logging (show first/last 4 chars)
const maskedToken = BOT_TOKEN.substring(0, 4) + '...' + BOT_TOKEN.substring(BOT_TOKEN.length - 4);
logger.info({ maskedToken, instanceId: INSTANCE_ID }, 'Bot token configured');

const bot = new Telegraf(BOT_TOKEN);

// *** APPLY TRACKING MIDDLEWARE TO CAPTURE ALL EVENTS ***
bot.use(trackingMiddleware);

// Handle Telegram errors globally
bot.catch((err, ctx) => {
  logger.error(
    {
      err: err.message,
      code: err.code,
      description: err.description,
      instanceId: INSTANCE_ID,
      updateType: ctx?.updateType,
      chatId: ctx?.chat?.id,
    },
    '🔴 Telegraf Error Caught'
  );

  // Specific handling for 409 Conflict
  if (err.code === 409 || err.description?.includes('Conflict')) {
    logger.error(
      {
        instanceId: INSTANCE_ID,
        hostname: HOSTNAME,
        startTime: START_TIME,
      },
      '⚠️ CONFLICT DETECTED: Another bot instance is running with the same token!'
    );
    logger.error(
      {
        action: 'REQUIRED',
        message:
          'Stop the other instance before starting this one. Only ONE bot instance can poll per token.',
      },
      '🛑 ACTION REQUIRED'
    );
  }
});

// --- Command Handlers ---

const HELP_MESSAGE = `
🙏 *Namaste! I am Guru Ji* 🧘‍♂️
Your AI-powered Nifty 50 Trading Assistant.

*Here is what I can do for you:*

🚀 *Market Intelligence*
• /feed - *Market Snapshot*: Get filtered Advance/Decline ratios and broad market sentiment.
• /high - *Top Gainers*: List of top 10 stocks driving the market up.
• /low - *Top Losers*: List of top 10 stocks dragging the market down.
• /movers - *Most Active*: Stocks with the highest trading volume today.

🧠 *AI Analysis*
• /ownanalysis - *Guru's Wisdom*: Recent Buy/Sell signals generated by the AI engine.
• /status - *System Health*: Check if the Guru is online and connected.

📥 *Data Management*
• /backfill - *Historical Data*: Trigger a backfill job with custom date range.
• /livestatus - *Live Console*: Stream real-time backfill progress (use /stop to end).

💡 *Feedback*
• /suggest <text> - Send feedback (Type message on SAME LINE!)

📰 *Updates*
• /news - *Market News*: Latest headlines (Coming Soon).
• /subscribe <email> - Get daily stock updates & feature changelogs via Email!
• /stop - Unsubscribe from alerts / Stop live stream.

_Select a command above to start!_
`;

// --- Interactive Menu Keyboard ---
const { Markup } = require('telegraf');

const mainMenu = Markup.keyboard([
  ['📊 Market Feed', '🚀 Top Gainers', '🩸 Top Losers'],
  ['🧠 AI Analysis', '🏥 System Status'],
  ['📥 Backfill', '📡 Live Status'],
  ['💡 Suggest', '📰 News'],
]).resize();

const sendMenu = (ctx, message = '') => {
  ctx.reply(message || HELP_MESSAGE, { parse_mode: 'Markdown', ...mainMenu });
  messagesSent.inc({ type: 'menu', status: 'success' });
};

bot.start(
  trackCommand('start', async (ctx) => {
    const chatId = ctx.chat.id;
    const username = ctx.from.username || 'Trader';

    try {
      await publisher.sAdd('telegram:subscribers', chatId.toString());
      logger.info({ chatId, username }, 'New subscriber');
      sendMenu(ctx, `Hello I am Guru Ji! 👋\nWelcome *${username}*.\n\n${HELP_MESSAGE}`);
    } catch (err) {
      logger.error({ err }, 'Failed to subscribe user');
      ctx.reply('❌ System Error: Could not subscribe.');
      botErrors.inc({ type: 'subscription_error', code: 'redis_error' });
    }
  })
);

bot.help(
  trackCommand('help', async (ctx) => {
    sendMenu(ctx);
  })
);

// Listen for "hi" or similar greetings
bot.hears(
  /^(hi|hello|hey|namaste)$/i,
  trackCommand('greeting', async (ctx) => {
    sendMenu(
      ctx,
      `🙏 *Namaste, ${ctx.from.username || 'Trader'}!*\n\nHow can Guru Ji assist you today?`
    );
  })
);

// Handle Keyboard Button Presses
bot.hears(
  '📊 Market Feed',
  trackCommand(
    'feed_button',
    async (ctx) =>
      ctx.scene?.enter?.('feed') ||
      bot.handleUpdate({ message: { ...ctx.message, text: '/feed' } }, ctx)
  )
);
bot.hears(
  '🚀 Top Gainers',
  trackCommand('high_button', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/high'))
);
bot.hears(
  '🩸 Top Losers',
  trackCommand('low_button', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/low'))
);
bot.hears(
  '🧠 AI Analysis',
  trackCommand('analysis_button', async (ctx) =>
    ctx.telegram.sendMessage(ctx.chat.id, '/ownanalysis')
  )
);
bot.hears(
  '🏥 System Status',
  trackCommand('status_button', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/status'))
);
bot.hears(
  '📥 Backfill',
  trackCommand('backfill_button', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/backfill'))
);
bot.hears(
  '📡 Live Status',
  trackCommand('livestatus_button', async (ctx) =>
    ctx.telegram.sendMessage(ctx.chat.id, '/livestatus')
  )
);
bot.hears(
  '💡 Suggest',
  trackCommand('suggest_button', async (ctx) =>
    ctx.reply('💡 To suggest, type: `/suggest Your suggestion here`', { parse_mode: 'Markdown' })
  )
);
bot.hears(
  '📰 News',
  trackCommand('news_button', async (ctx) => ctx.telegram.sendMessage(ctx.chat.id, '/news'))
);

bot.command(
  'suggest',
  trackCommand('suggest', async (ctx) => {
    const text = ctx.message.text.replace('/suggest', '').trim();
    logger.info({ user: ctx.from.username, text }, 'Suggestion Command Received');

    if (!text) {
      return ctx.reply(
        '⚠️ *Incorrect Format*\n\n' +
          'Please type the message on the *same line* as the command.\n\n' +
          '✅ *Correct*:\n' +
          '`/suggest Add more charts`\n\n' +
          '❌ *Wrong*:\n' +
          '`/suggest` [Enter]\n' +
          '(Typing message separately)',
        { parse_mode: 'Markdown' }
      );
    }

    try {
      const res = await axios.post('http://backend-api:4000/api/v1/suggestions', {
        user: ctx.from.username || 'Anonymous',
        text: text,
        source: 'telegram',
      });
      logger.info({ status: res.status, data: res.data }, 'Suggestion API Response');
      ctx.reply('🙏 *Dhanyavac user*! Your suggestion has been noted.', { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err: err.message, stack: err.stack }, 'Suggestion Failed');
      ctx.reply('❌ Failed to save suggestion. Try again later.');
      botErrors.inc({ type: 'api_error', code: 'suggestion_failed' });
    }
  })
);

bot.command(
  'subscribe',
  trackCommand('subscribe', async (ctx) => {
    const email = ctx.message.text.replace('/subscribe', '').trim();
    const chatId = ctx.chat.id;
    const username = ctx.from.username || 'Anonymous';

    if (!email || !email.includes('@')) {
      return ctx.reply(
        '📧 Please provide a valid email address.\nUsage: `/subscribe your@email.com`',
        { parse_mode: 'Markdown' }
      );
    }

    try {
      const res = await axios.post('http://backend-api:4000/api/v1/subscribers', {
        chatId: chatId,
        username: username,
        email: email,
      });

      if (res.data.success) {
        ctx.reply(
          '✅ *Subscription Successful!* You are now on our list for regular updates and new feature releases.',
          { parse_mode: 'Markdown' }
        );
      } else {
        ctx.reply('❌ Subscription failed. Please try again later.');
        botErrors.inc({ type: 'subscription_error', code: 'api_failure' });
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Subscription Failed');
      ctx.reply('❌ System Error: Could not save subscription.');
      botErrors.inc({ type: 'subscription_error', code: 'exception' });
    }
  })
);

// --- Helper Functions ---
async function getMarketData() {
  const data = await publisher.get('market_view:latest');
  return data ? JSON.parse(data) : null;
}

const formatStock = (s) => `• *${s.symbol}*: ${s.change_pct.toFixed(2)}% (₹${s.ltp})`;

bot.command(
  'feed',
  trackCommand('feed', async (ctx) => {
    const marketStatus = isMarketOpen();
    const market = await getMarketData();

    // If no data available
    if (!market) {
      if (!marketStatus.open) {
        return ctx.reply(
          `${marketStatus.message}\n\n📉 *No market data available*\n_Data will be available during trading hours._`,
          { parse_mode: 'Markdown' }
        );
      }
      return ctx.reply('📉 Market data unavailable. Please try again.');
    }

    const { breadth } = market;
    const statusHeader = marketStatus.open ? '🟢 *LIVE*' : '🔴 *CLOSED*';

    const msg =
      `📊 *Market Snapshot* ${statusHeader}\n` +
      `⏰ ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n` +
      `📈 *Sentiment*: ${breadth.market_sentiment}\n` +
      `🟢 *Advance*: ${breadth.advance_count}\n` +
      `🔴 *Decline*: ${breadth.decline_count}\n` +
      `⚖️ *A/D Ratio*: ${breadth.advance_decline.toFixed(2)}` +
      (marketStatus.open ? '' : `\n\n_${marketStatus.message}_`);

    ctx.reply(msg, { parse_mode: 'Markdown' });
  })
);

bot.command(
  'high',
  trackCommand('high', async (ctx) => {
    const market = await getMarketData();
    if (!market) return ctx.reply('📉 Market data unavailable.');
    const list = market.top_gainers.slice(0, 10).map(formatStock).join('\n');
    ctx.reply(`🚀 *Top Gainers*\n\n${list}`, { parse_mode: 'Markdown' });
  })
);

bot.command(
  'low',
  trackCommand('low', async (ctx) => {
    const market = await getMarketData();
    if (!market) return ctx.reply('📉 Market data unavailable.');
    const list = market.top_losers.slice(0, 10).map(formatStock).join('\n');
    ctx.reply(`🩸 *Top Losers*\n\n${list}`, { parse_mode: 'Markdown' });
  })
);

bot.command(
  'movers',
  trackCommand('movers', async (ctx) => {
    const market = await getMarketData();
    if (!market) return ctx.reply('📉 Market data unavailable.');
    // Assuming most_active exists in market view schema, otherwise fallback to top_gainers
    const movers = market.most_active || market.top_gainers;
    const list = movers.slice(0, 10).map(formatStock).join('\n');
    ctx.reply(`🌪 *Most Active*\n\n${list}`, { parse_mode: 'Markdown' });
  })
);

bot.command(
  'news',
  trackCommand('news', async (ctx) => {
    ctx.reply('📰 *Latest News*\n\nFeature coming soon! Integration with NewsAPI pending.', {
      parse_mode: 'Markdown',
    });
  })
);

bot.command(
  'ownanalysis',
  trackCommand('ownanalysis', async (ctx) => {
    try {
      // Fetch last 5 signals from Redis List
      // LRANGE signals:history 0 4
      const history = await publisher.lRange('signals:history', 0, 4);

      if (!history || history.length === 0) {
        return ctx.reply('🧠 No recent analysis available.');
      }

      const msgs = history
        .map((item) => {
          const s = JSON.parse(item);
          const icon = s.action === 'BUY' ? '🟢' : '🔴';
          return `${icon} *${s.symbol}* (${s.action}) @ ₹${s.price}\n   Conf: ${(s.confidence * 100).toFixed(0)}% | ${new Date(s.timestamp).toLocaleTimeString()}`;
        })
        .join('\n\n');

      ctx.reply(`🧠 *Recent AI Analysis*\n\n${msgs}`, { parse_mode: 'Markdown' });
    } catch (err) {
      logger.error({ err }, 'Analysis Fetch Error');
      ctx.reply('❌ Error fetching analysis.');
    }
  })
);

const cron = require('node-cron');
const axios = require('axios');

// --- Scheduled Tasks ---
// 9:00 AM IST (India) = 03:30 UTC
cron.schedule('30 3 * * 1-5', () => {
  const msg =
    `🌅 *Good Morning Traders!* ☀️\n` +
    `Markets are opening soon. Guru Ji wishes you high profits!\n` +
    `_Check /feed for pre-market sentiment._`;
  broadcast(msg);
});

bot.command(
  'status',
  trackCommand('status', async (ctx) => {
    ctx.reply('🔍 *Checking System Health*...');

    const services = [
      { name: 'API', url: 'http://backend-api:4000/health' },
      { name: 'Ingestion', url: 'http://ingestion:3000/health' }, // Assuming L1 exposes 3000
      { name: 'Analysis', url: 'http://analysis:8081/health' },
      { name: 'Aggregation', url: 'http://aggregation:8080/health' },
      { name: 'Signal', url: 'http://signal:8082/health' },
    ];

    let report = `🏥 *System Health Report*\n\n`;

    for (const s of services) {
      try {
        await axios.get(s.url, { timeout: 2000 });
        report += `✅ *${s.name}*: UP\n`;
      } catch {
        report += `❌ *${s.name}*: DOWN\n`;
      }
    }

    // Redis Check
    try {
      await publisher.ping();
      report += `✅ *Redis*: UP\n`;
    } catch {
      report += `❌ *Redis*: DOWN\n`;
    }

    // Data Stats (from Redis)
    const vol = await publisher.get('stats:daily_volume');
    report += `\n📊 *Data Processed*: ${vol || 0} rows today`;

    ctx.reply(report, { parse_mode: 'Markdown' });
  })
);

// --- Live Status Sessions (per chat) ---
const liveStatusSessions = new Map(); // chatId -> { intervalId, messageId }

bot.command(
  'backfill',
  trackCommand('backfill', async (ctx) => {
    const args = ctx.message.text.replace('/backfill', '').trim();
    const chatId = ctx.chat.id;

    // Default: 5 days, 1 minute candles
    let days = 5;
    let interval = 'ONE_MINUTE';

    // Parse arguments like "30d 1m" or "7d"
    const dayMatch = args.match(/(\d+)d/i);
    const intervalMatch = args.match(/(1m|5m|10m|15m|1h|1d)/i);

    if (dayMatch) days = parseInt(dayMatch[1], 10);
    if (intervalMatch) {
      const intervalMap = {
        '1m': 'ONE_MINUTE',
        '5m': 'FIVE_MINUTE',
        '10m': 'TEN_MINUTE',
        '15m': 'FIFTEEN_MINUTE',
        '1h': 'ONE_HOUR',
        '1d': 'ONE_DAY',
      };
      interval = intervalMap[intervalMatch[1].toLowerCase()] || 'ONE_MINUTE';
    }

    const jobId = `backfill-${Date.now()}`;
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    try {
      // Trigger backfill via Redis command
      await publisher.publish(
        'system:commands',
        JSON.stringify({
          command: 'START_BACKFILL',
          params: {
            fromDate: fromStr,
            toDate: toStr,
            interval: interval,
            triggerSource: 'telegram',
            jobId: jobId,
          },
        })
      );

      const msg =
        `⚡ *Backfill Job Started*\n\n` +
        `📊 *Job ID*: \`${jobId}\`\n` +
        `📦 *Symbols*: ALL (Nifty 50)\n` +
        `📅 *Range*: ${fromStr} to ${toStr}\n` +
        `⏱ *Interval*: ${interval}\n` +
        `🕒 *Started*: ${new Date().toLocaleString()}\n\n` +
        `_You will receive a notification when complete._\n` +
        `_Use /livestatus to stream live progress._`;

      ctx.reply(msg, { parse_mode: 'Markdown' });
      logger.info({ jobId, days, interval, chatId }, 'Backfill triggered via Telegram');
    } catch (err) {
      logger.error({ err }, 'Failed to trigger backfill');
      ctx.reply('❌ Failed to trigger backfill. Check system logs.');
      botErrors.inc({ type: 'api_error', code: 'backfill_failed' });
    }
  })
);

bot.command(
  'livestatus',
  trackCommand('livestatus', async (ctx) => {
    const chatId = ctx.chat.id;

    // Check if already streaming
    if (liveStatusSessions.has(chatId)) {
      return ctx.reply('📡 Live stream already active. Use /stop to end it first.');
    }

    const initialMsg = await ctx.reply('📡 *Live Console* - Connecting...', {
      parse_mode: 'Markdown',
    });
    const messageId = initialMsg.message_id;

    let lastLogIndex = 0;

    const updateStatus = async () => {
      try {
        const backfillData = await publisher.get('system:layer1:backfill');
        const logsRaw = await publisher.lRange('system:layer1:logs', 0, 9); // Last 10 logs

        const status = backfillData
          ? JSON.parse(backfillData)
          : { status: 0, progress: 0, details: 'Idle' };
        const logs = logsRaw || [];

        const statusIcon =
          status.status === 1
            ? '🔄'
            : status.status === 2
              ? '✅'
              : status.status === 3
                ? '❌'
                : '⏸️';
        const logLines = logs
          .slice(0, 5)
          .map((l, i) => `\`${i + 1}.\` ${l}`)
          .join('\n');

        const text =
          `📡 *Live Console*\n\n` +
          `${statusIcon} *Status*: ${status.status === 1 ? 'Running' : status.status === 2 ? 'Completed' : status.status === 3 ? 'Failed' : 'Idle'}\n` +
          `📊 *Progress*: ${status.progress}%\n` +
          `📝 *Details*: ${status.details || '-'}\n\n` +
          `🖥️ *Recent Logs*:\n${logLines || '_No logs yet_'}\n\n` +
          `_Use /stop to end stream_`;

        await ctx.telegram.editMessageText(chatId, messageId, null, text, {
          parse_mode: 'Markdown',
        });

        // Auto-stop if completed or idle
        if (status.status === 2 || status.status === 0) {
          const session = liveStatusSessions.get(chatId);
          if (session) {
            clearInterval(session.intervalId);
            liveStatusSessions.delete(chatId);
            await ctx.telegram.editMessageText(
              chatId,
              messageId,
              null,
              text + '\n\n✅ *Stream ended (job finished).*',
              { parse_mode: 'Markdown' }
            );
          }
        }
      } catch (err) {
        logger.error({ err }, 'Live status update error');
      }
    };

    // Update every 3 seconds
    const intervalId = setInterval(updateStatus, 3000);
    liveStatusSessions.set(chatId, { intervalId, messageId });

    // Initial update
    await updateStatus();
    logger.info({ chatId }, 'Live status stream started');
  })
);

bot.command(
  'stop',
  trackCommand('stop', async (ctx) => {
    const chatId = ctx.chat.id;

    // Stop live status stream if active
    if (liveStatusSessions.has(chatId)) {
      const session = liveStatusSessions.get(chatId);
      clearInterval(session.intervalId);
      liveStatusSessions.delete(chatId);
      ctx.reply('📡 Live stream stopped.');
      return;
    }

    // Otherwise, unsubscribe from alerts
    try {
      await publisher.sRem('telegram:subscribers', chatId.toString());
      ctx.reply('🔕 You have unsubscribed from alerts.');
    } catch {
      ctx.reply('❌ Error unsubscribing.');
      botErrors.inc({ type: 'api_error', code: 'unsubscribe_failed' });
    }
  })
);

// --- Notification Logic ---

async function broadcast(message) {
  try {
    const subscribers = await publisher.sMembers('telegram:subscribers');
    if (subscribers.length === 0) return;

    logger.info({ count: subscribers.length }, 'Broadcasting message');

    const promises = subscribers.map((chatId) =>
      bot.telegram
        .sendMessage(chatId, message, { parse_mode: 'Markdown' })
        .then(() => messagesSent.inc({ type: 'alert', status: 'success' }))
        .catch((err) => {
          if (err.response && err.response.error_code === 403) {
            // User blocked bot
            publisher.sRem('telegram:subscribers', chatId);
          } else {
            logger.error({ err, chatId }, 'Failed to send message');
          }
        })
    );

    await Promise.all(promises);
  } catch (err) {
    logger.error({ err }, 'Broadcast error');
  }
}

// Broadcast with optional extra options (e.g., inline keyboard)
async function broadcastWithMarkup(message, extra = {}) {
  try {
    const subscribers = await publisher.sMembers('telegram:subscribers');
    if (subscribers.length === 0) return;

    logger.info({ count: subscribers.length }, 'Broadcasting message with markup');

    const promises = subscribers.map((chatId) =>
      bot.telegram
        .sendMessage(chatId, message, { parse_mode: 'Markdown', ...extra })
        .then(() => messagesSent.inc({ type: 'alert', status: 'success' }))
        .catch((err) => {
          if (err.response && err.response.error_code === 403) {
            publisher.sRem('telegram:subscribers', chatId);
          } else {
            logger.error({ err, chatId }, 'Failed to send message');
          }
        })
    );

    await Promise.all(promises);
  } catch (err) {
    logger.error({ err }, 'Broadcast error');
  }
}

// --- Inline Button Callback Handlers ---
bot.action('cmd_ownanalysis', async (ctx) => {
  await ctx.answerCbQuery();
  // Simulate /ownanalysis
  const history = await publisher.lRange('signals:history', 0, 4);
  if (!history || history.length === 0) {
    return ctx.reply('🧠 No recent analysis available.');
  }
  const msgs = history
    .map((item) => {
      const s = JSON.parse(item);
      const icon = s.action === 'BUY' ? '🟢' : '🔴';
      return `${icon} *${s.symbol}* (${s.action}) @ ₹${s.price}\n   Conf: ${(s.confidence * 100).toFixed(0)}%`;
    })
    .join('\n\n');
  ctx.reply(`🧠 *Recent AI Analysis*\n\n${msgs}`, { parse_mode: 'Markdown' });
});

bot.action('cmd_movers', async (ctx) => {
  await ctx.answerCbQuery();
  const market = await getMarketData();
  if (!market) return ctx.reply('📉 Market data unavailable.');
  const movers = market.most_active || market.top_gainers;
  const list = movers.slice(0, 10).map(formatStock).join('\n');
  ctx.reply(`🌪 *Most Active*\n\n${list}`, { parse_mode: 'Markdown' });
});

bot.action('cmd_high', async (ctx) => {
  await ctx.answerCbQuery();
  const market = await getMarketData();
  if (!market) return ctx.reply('📉 Market data unavailable.');
  const list = market.top_gainers.slice(0, 10).map(formatStock).join('\n');
  ctx.reply(`🚀 *Top Gainers*\n\n${list}`, { parse_mode: 'Markdown' });
});

bot.action('cmd_low', async (ctx) => {
  await ctx.answerCbQuery();
  const market = await getMarketData();
  if (!market) return ctx.reply('📉 Market data unavailable.');
  const list = market.top_losers.slice(0, 10).map(formatStock).join('\n');
  ctx.reply(`🩸 *Top Losers*\n\n${list}`, { parse_mode: 'Markdown' });
});

bot.action('cmd_feed', async (ctx) => {
  await ctx.answerCbQuery();
  const market = await getMarketData();
  if (!market) return ctx.reply('📉 Market data unavailable.');
  const { breadth } = market;
  const msg =
    `📊 *Market Snapshot* (${new Date().toLocaleTimeString()})\n\n` +
    `📈 *Sentiment*: ${breadth.market_sentiment}\n` +
    `🟢 *Advance*: ${breadth.advance_count}\n` +
    `🔴 *Decline*: ${breadth.decline_count}\n` +
    `⚖️ *A/D Ratio*: ${breadth.advance_decline.toFixed(2)}`;
  ctx.reply(msg, { parse_mode: 'Markdown' });
});

// Subscribe to Channels
async function startRedis() {
  await subscriber.connect();
  await publisher.connect();

  subscriber.subscribe('system:notifications', (message) => {
    broadcast(`📢 *System Notification*\n\n${message}`);
  });

  subscriber.subscribe('notifications:backfill', (message) => {
    try {
      const data = JSON.parse(message);
      const text =
        `📥 *Backfill Complete* ✅\n\n` +
        `📦 *Symbol*: ${data.symbol || 'Nifty 50'}\n` +
        `📅 *Range*: ${data.start_date} to ${data.end_date}\n` +
        `📊 *Records Added*: ${data.count}\n` +
        `⏱ *Duration*: ${data.duration}s\n\n` +
        `_Analytical Engine will now process this data._`;
      broadcast(text);
    } catch {
      logger.error('Invalid backfill msg');
    }
  });

  // New: Enhanced backfill status notifications
  subscriber.subscribe('backfill:status', (message) => {
    try {
      const data = JSON.parse(message);
      let text = '';
      let extra = {}; // For inline keyboard

      if (data.type === 'START') {
        text =
          `🚀 *Backfill Job Started*\n\n` +
          `📊 *Job ID*: \`${data.jobId}\`\n` +
          `📦 *Symbols*: ${data.symbols}\n` +
          `📅 *Range*: ${data.fromDate} to ${data.toDate}\n` +
          `⏱ *Interval*: ${data.interval}\n\n` +
          `_Processing historical data..._`;
      } else if (data.type === 'COMPLETE') {
        text =
          `✅ *Backfill Job Complete*\n\n` +
          `📊 *Job ID*: \`${data.jobId}\`\n` +
          `📦 *Symbols*: ${data.symbols}\n` +
          `📅 *Range*: ${data.fromDate} to ${data.toDate}\n` +
          `✅ *Success*: ${data.successCount} symbols\n` +
          `❌ *Failed*: ${data.failCount} symbols\n` +
          `📈 *Total Candles*: ${data.totalCandles}\n` +
          `💾 *DB Rows*: ${data.dbRowsInserted}\n` +
          `⏱ *Duration*: ${data.durationSeconds}s\n\n` +
          `_Data ready for analysis! What would you like to do next?_`;

        // Add inline keyboard for post-backfill actions
        extra = {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🧠 AI Analysis', callback_data: 'cmd_ownanalysis' },
                { text: '🌪 Most Active', callback_data: 'cmd_movers' },
              ],
              [
                { text: '🚀 Top Gainers', callback_data: 'cmd_high' },
                { text: '🩸 Top Losers', callback_data: 'cmd_low' },
              ],
              [{ text: '📊 Market Feed', callback_data: 'cmd_feed' }],
            ],
          },
        };
      } else if (data.type === 'ERROR') {
        text =
          `❌ *Backfill Job Failed*\n\n` +
          `📊 *Job ID*: \`${data.jobId}\`\n` +
          `🔴 *Error*: ${data.error}\n\n` +
          `_Please check logs for details._`;
      }

      if (text) {
        // Broadcast with optional inline keyboard
        broadcastWithMarkup(text, extra);
      }
    } catch {
      logger.error('Invalid backfill:status msg');
    }
  });

  subscriber.subscribe('signals:new', (message) => {
    try {
      const signal = JSON.parse(message);
      const icon = signal.action === 'BUY' ? '🟢' : '🔴';
      const text =
        `${icon} *New Signal: ${signal.symbol}*\n` +
        `Action: *${signal.action}*\n` +
        `Price: ${signal.price}\n` +
        `Time: ${signal.timestamp}`;
      broadcast(text);
    } catch {
      logger.error('Invalid signal format');
    }
  });

  logger.info('✅ Connected to Redis Pub/Sub');
}

// --- Express Server (Metrics/Health) ---

app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.send(await register.metrics());
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    bot: 'Authorized',
    instanceId: INSTANCE_ID,
    hostname: HOSTNAME,
    startTime: START_TIME,
    uptime: process.uptime(),
  });
});

// Start Everything
async function main() {
  logger.info({ instanceId: INSTANCE_ID }, '📡 Initializing bot services...');

  try {
    await startRedis();

    logger.info({ instanceId: INSTANCE_ID }, '🚀 Launching Telegram bot polling...');

    // Launch with error handling for conflicts
    bot
      .launch({
        dropPendingUpdates: false, // Set to true if you want to ignore messages received while offline
      })
      .then(() => {
        logger.info(
          {
            instanceId: INSTANCE_ID,
            hostname: HOSTNAME,
            event: 'BOT_LAUNCHED',
          },
          '🤖 Telegram Bot Successfully Started'
        );

        // Store instance info in Redis for debugging
        publisher.set(
          'telegram:bot:instance',
          JSON.stringify({
            instanceId: INSTANCE_ID,
            hostname: HOSTNAME,
            startTime: START_TIME,
            pid: process.pid,
          }),
          { EX: 86400 }
        ); // Expire in 24h

        // Notify admin/subscribers of deployment
        broadcast(`🙏 *Namaste Ji!* Guru Ji is back online. 🚀\n_Instance: ${INSTANCE_ID}_`);
      })
      .catch((err) => {
        logger.error(
          {
            err: err.message,
            code: err.code,
            description: err.description,
            response: err.response,
            instanceId: INSTANCE_ID,
          },
          '❌ Bot Launch Failed'
        );

        if (err.code === 409 || err.description?.includes('Conflict')) {
          logger.error(
            {
              instanceId: INSTANCE_ID,
              hostname: HOSTNAME,
            },
            '🔴 CONFLICT: Another instance is already polling this bot token!'
          );

          logger.error(
            {
              fix1: 'Stop the other bot instance (docker stop telegram-bot)',
              fix2: 'Check if bot is running on both local and AWS',
              fix3: 'Wait 30 seconds and try again (Telegram has a timeout)',
            },
            '💡 How to fix:'
          );

          // Try to get info about the other instance
          publisher
            .get('telegram:bot:instance')
            .then((data) => {
              if (data) {
                const other = JSON.parse(data);
                logger.warn(
                  {
                    otherInstanceId: other.instanceId,
                    otherHostname: other.hostname,
                    otherStartTime: other.startTime,
                    currentInstanceId: INSTANCE_ID,
                  },
                  '🔍 Found other running instance info'
                );
              }
            })
            .catch(() => {});
        }

        // Exit after logging
        process.exit(1);
      });

    app.listen(port, () => {
      logger.info(
        {
          port,
          instanceId: INSTANCE_ID,
          event: 'SERVER_LISTENING',
        },
        `📡 HTTP Server listening on port ${port}`
      );
    });

    // Graceful Stop
    process.once('SIGINT', () => {
      logger.info({ instanceId: INSTANCE_ID, signal: 'SIGINT' }, '🛑 Shutting down bot...');
      bot.stop('SIGINT');
      process.exit(0);
    });
    process.once('SIGTERM', () => {
      logger.info({ instanceId: INSTANCE_ID, signal: 'SIGTERM' }, '🛑 Shutting down bot...');
      bot.stop('SIGTERM');
      process.exit(0);
    });
  } catch (err) {
    logger.error({ err, instanceId: INSTANCE_ID }, '💀 Fatal Error during startup');
    process.exit(1);
  }
}

main();
