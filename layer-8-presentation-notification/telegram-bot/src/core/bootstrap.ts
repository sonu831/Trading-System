const redis = require('./redis');
const kafka = require('./kafka');
const logger = require('./logger');

class Bootstrap {
  constructor() {
    this.isShuttingDown = false;
  }

  async init(startBotFn) {
    try {
      logger.info('🚀 Bootstrapping Application...');

      // 1. Connect Infrastructure
      await redis.connect();
      await kafka.connect();

      // 2. Start Bot
      if (startBotFn) {
        logger.info('🤖 Starting Telegram Bot...');
        await startBotFn();
      }

      // 3. Register Shutdown Signals
      this.registerSignals();

      logger.info('✅ Application Ready');
    } catch (err) {
      logger.fatal({ err }, '💀 Fatal Error during bootstrap');
      process.exit(1);
    }
  }

  registerSignals() {
    ['SIGINT', 'SIGTERM'].forEach((signal) => {
      process.once(signal, async () => {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        logger.info({ signal }, '🛑 Graceful Shutdown Initiated...');

        try {
          // Add your shutdown logic here
          // e.g. await bot.stop();
          await kafka.disconnect();
          await redis.disconnect();

          logger.info('👋 Shutdown Complete');
          process.exit(0);
        } catch (err) {
          logger.error({ err }, '❌ Error during shutdown');
          process.exit(1);
        }
      });
    });
  }
}

module.exports = new Bootstrap();
