const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  constructor() {
    this.subscriber = createClient({ url: REDIS_URL });
    this.publisher = createClient({ url: REDIS_URL });
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));

    await this.subscriber.connect();
    await this.publisher.connect();

    this.isConnected = true;
    console.log(`✅ Layer 6 Connected to Redis: ${REDIS_URL}`);
  }

  /**
   * Subscribe to a channel
   * @param {string} channel
   * @param {function} callback
   */
  async subscribe(channel, callback) {
    if (!this.isConnected) await this.connect();

    await this.subscriber.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (err) {
        console.error(`❌ Failed to parse message on ${channel}:`, err.message);
      }
    });
    console.log(`📡 Subscribed to ${channel}`);
  }

  /**
   * Publish a signal
   * @param {string} channel
   * @param {Object} message
   */
  async publish(channel, message) {
    if (!this.isConnected) await this.connect();

    const payload = JSON.stringify(message);
    await this.publisher.publish(channel, payload);
    // Also set typical key for persistence/debugging if needed, but Signals are events.
  }

  async get(key) {
    if (!this.isConnected) await this.connect();
    const val = await this.publisher.get(key);
    return val ? JSON.parse(val) : null;
  }

  async set(key, value) {
    if (!this.isConnected) await this.connect();
    await this.publisher.set(key, JSON.stringify(value));
  }

  /**
   * Push item to list (LPUSH) with max length
   */
  async pushToList(key, item, maxLength = 100) {
    if (!this.isConnected) await this.connect();
    const payload = JSON.stringify(item);
    await this.publisher.lPush(key, payload);
    await this.publisher.lTrim(key, 0, maxLength - 1);
  }

  async disconnect() {
    await this.subscriber.disconnect();
    await this.publisher.disconnect();
    this.isConnected = false;
  }
}

module.exports = new RedisClient();
