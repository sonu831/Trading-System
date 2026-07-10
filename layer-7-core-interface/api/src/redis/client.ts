const { createClient } = require('redis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

class RedisClient {
  constructor() {
    this.subscriber = createClient({ url: REDIS_URL });
    this.publisher = createClient({ url: REDIS_URL }); // For generic commands
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return;

    this.subscriber.on('error', (err) => console.error('Redis Subscriber Error:', err));
    this.publisher.on('error', (err) => console.error('Redis Publisher Error:', err));

    await this.subscriber.connect();
    await this.publisher.connect();

    this.isConnected = true;
    console.log(`✅ API Connected to Redis: ${REDIS_URL}`);
  }

  async subscribe(channel, callback) {
    if (!this.isConnected) await this.connect();
    await this.subscriber.subscribe(channel, (message) => {
      try {
        const data = JSON.parse(message);
        callback(data);
      } catch (e) {
        console.error('Redis Parse Error', e);
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
}

module.exports = new RedisClient();
