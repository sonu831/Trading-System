const BaseRepository = require('../../common/repositories/BaseRepository');

class SignalRepository extends BaseRepository {
  constructor({ redis }) {
    super({ redis });
    this.redis = redis;
  }

  async getRecentSignals(limit = 100) {
    // Determine if we are using list or stream or simple key
    // Existing logic used: redis.getList('signals:history')
    // Assuming getList is helper or we use native lrange?
    // Redis client wrapper seems to have helper methods.
    // If not, use standard redis command: this.redis.lrange('signals:history', 0, limit - 1)

    // Checking previous usage in index.js: await redis.getList('signals:history');
    // So we invoke that helper.
    return this.redis.getList('signals:history');
  }
}

module.exports = SignalRepository;
