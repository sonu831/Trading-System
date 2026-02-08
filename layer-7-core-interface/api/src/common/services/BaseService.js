class BaseService {
  constructor({ redis, logger }) {
    this.redis = redis;
    this.logger = logger;
  }

  // Caching Helper
  async getCached(key) {
    if (!this.redis.isOpen) return null;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setCached(key, value, ttlSeconds = 60) {
    if (!this.redis.isOpen) return;
    await this.redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }
}

module.exports = BaseService;
