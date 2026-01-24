const { createClient } = require('redis');

class SocketService {
  constructor(io) {
    this.io = io;
    this.redisSubscriber = null;
    this.init();
  }

  async init() {
    try {
      // Separate Redis client for subscription (blocking connection)
      this.redisSubscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      await this.redisSubscriber.connect();

      // Subscribe to internal system channels
      await this.redisSubscriber.subscribe('market_ticks', (message) => {
        this.broadcastTick(message);
      });

      await this.redisSubscriber.subscribe('signals', (message) => {
        this.broadcastSignal(message);
      });

      console.log('✅ SocketService: Subscribed to Redis channels');
    } catch (err) {
      console.error('❌ SocketService Error:', err);
    }
  }

  // Broadcast to 'market-stream' room (Optimization: room per symbol?)
  // For 50 stocks, one room is fine. For 5000, we'd need room per symbol.
  broadcastTick(message) {
    try {
      // Message is JSON string from Redis
      // IO emit to 'market-stream' namespace/room
      this.io.to('market-stream').emit('tick', JSON.parse(message));
    } catch (e) {
      console.error('Error broadcasting tick:', e);
    }
  }

  broadcastSignal(message) {
    try {
      this.io.to('signals-stream').emit('signal', JSON.parse(message));
    } catch (e) {
      console.error('Error broadcasting signal:', e);
    }
  }
}

module.exports = SocketService;
