const redis = require('../core/redis');
const logger = require('../core/logger');

class BackfillService {
  constructor() {
    this.redis = redis;
  }

  async triggerBackfill(params) {
    const { days = 5, interval = 'ONE_MINUTE', triggerSource = 'telegram' } = params;
    const jobId = `backfill-${Date.now()}`;
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - days * 24 * 60 * 60 * 1000);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    const payload = {
      command: 'START_BACKFILL',
      params: {
        fromDate: fromStr,
        toDate: toStr,
        interval,
        triggerSource,
        jobId,
      },
    };

    logger.info({ jobId, payload }, 'Triggering backfill job');

    try {
      await this.redis.publish('system:commands', JSON.stringify(payload));
      return { success: true, jobId, fromStr, toStr, interval };
    } catch (err) {
      logger.error({ err }, 'Failed to publish backfill command');
      throw err;
    }
  }

  // Helper to parse "30d" or "15m" strings
  parseArgs(args) {
    let days = 5;
    let interval = 'ONE_MINUTE';

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

    return { days, interval };
  }
}

module.exports = new BackfillService();
