const { createClient } = require('redis');
const { logger } = require('../common/logger');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

/**
 * @class RedisClient
 * @description Wrapper around Redis client to provide a singleton instance
 * with error handling, logging, and common utility methods.
 * Supports both subscriber and publisher connections.
 */
class RedisClient {
  constructor() {
    this.subscriber = createClient({ url: REDIS_URL });
    this.publisher = createClient({ url: REDIS_URL }); // For generic commands
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    this.subscriber.on('error', (err) => logger.error({ err }, 'Redis Subscriber Error'));
    this.publisher.on('error', (err) => logger.error({ err }, 'Redis Publisher Error'));

    await this.subscriber.connect();
    await this.publisher.connect();

    this.isConnected = true;
    logger.info(`✅ API Connected to Redis: ${REDIS_URL}`);
  }

  async subscribe(channel, callback) {
    if (!this.isConnected) await this.connect();
    await this.subscriber.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (e) {
        logger.error({ err: e }, 'Redis Parse Error');
      }
    });
  }

  async get(key) {
    if (!this.isConnected) await this.connect();
    const val = await this.publisher.get(key);
    return val ? JSON.parse(val) : null;
  }

  async getList(key, start = 0, stop = -1) {
    if (!this.isConnected) await this.connect();
    const list = await this.publisher.lRange(key, start, stop);
    return list.map((item) => {
      try {
        return JSON.parse(item);
      } catch (e) {
        // Fallback for legacy plain text logs
        return { message: item, timestamp: new Date().toISOString(), type: 'raw' };
      }
    });
  }

  // Generic methods exposed for raw access if needed, or mapped
  async set(key, value, options) {
    if (!this.isConnected) await this.connect();
    return this.publisher.set(key, value, options);
  }

  async hGetAll(key) {
    if (!this.isConnected) await this.connect();
    return this.publisher.hGetAll(key);
  }
  
  async del(key) {
    if (!this.isConnected) await this.connect();
    return this.publisher.del(key);
  }
  
  // Expose raw client for advanced usage
  get raw() {
    return this.publisher;
  }
}

module.exports = new RedisClient();
