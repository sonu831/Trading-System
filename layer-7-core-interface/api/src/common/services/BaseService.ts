import type { RedisClient } from '../repositories/BaseRepository';

class BaseService {
  protected redis: RedisClient;

  constructor({ redis }: { redis: RedisClient }) {
    this.redis = redis;
  }

  async getCached(key: string): Promise<unknown | null> {
    if (!this.redis.isOpen) return null;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async setCached(key: string, value: unknown, ttlSeconds = 60): Promise<void> {
    if (!this.redis.isOpen) return;
    await this.redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }
}

module.exports = BaseService;
