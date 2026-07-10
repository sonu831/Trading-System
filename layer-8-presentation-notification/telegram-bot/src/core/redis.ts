const { createClient } = require('redis');
const config = require('../config');
const logger = require('./logger');

class RedisClient {
  constructor() {
    this.publisher = null;
    this.subscriber = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    logger.info('🔌 Connecting to Redis...');

    this.publisher = createClient({ url: config.redis.url });
    this.subscriber = createClient({ url: config.redis.url });

    // Error Handling
    this.publisher.on('error', (err) => logger.error({ err }, 'Redis Publisher Error'));
    this.subscriber.on('error', (err) => logger.error({ err }, 'Redis Subscriber Error'));

    this.publisher.on('connect', () => logger.info('✅ Redis Publisher Connected'));
    this.subscriber.on('connect', () => logger.info('✅ Redis Subscriber Connected'));

    await Promise.all([this.publisher.connect(), this.subscriber.connect()]);
    this.isConnected = true;
  }

  async disconnect() {
    if (!this.isConnected) return;
    logger.info('🛑 Disconnecting Redis...');
    await Promise.all([this.publisher.disconnect(), this.subscriber.disconnect()]);
    this.isConnected = false;
  }

  // Wrapper for common operations
  async get(key) {
    return this.publisher.get(key);
  }

  async set(key, value, options) {
    return this.publisher.set(key, value, options);
  }

  async subscribe(channel, callback) {
    return this.subscriber.subscribe(channel, callback);
  }

  async publish(channel, message) {
    if (typeof message === 'object') {
      message = JSON.stringify(message);
    }
    return this.publisher.publish(channel, message);
  }
}

// Export singleton
module.exports = new RedisClient();
