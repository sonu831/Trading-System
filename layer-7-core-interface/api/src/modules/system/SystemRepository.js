const BaseRepository = require('../../common/repositories/BaseRepository');

class SystemRepository extends BaseRepository {
  constructor({ redis, prisma }) {
    super({ redis, prisma });
  }

  async getLogs(limit = 50) {
    return this.redis.getList('system:layer1:logs', 0, limit - 1);
  }

  async getMetric(key) {
    try {
      const data = await this.redis.get(key);
      return data || null;
    } catch (e) {
      return null;
    }
  }

  async getSignalCount() {
    try {
      return await this.redis.publisher.lLen('signals:history');
    } catch {
      return 0;
    }
  }

  async getCandleCount() {
    try {
      return await this.prisma.candles_1m.count();
    } catch {
      return 0;
    }
  }

  async triggerBackfill(params) {
    await this.redis.publisher.publish(
      'system:commands',
      JSON.stringify({ command: 'START_BACKFILL', params, timestamp: Date.now() })
    );
  }
}

module.exports = SystemRepository;
