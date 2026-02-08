const { createClient } = require('redis');

class SocketService {
  /**
   * SocketService handles real-time WebSocket communication
   * and persists system notifications to the database.
   * 
   * @param {Object} io - Socket.IO server instance
   * @param {Object} notificationService - Service for persisting notifications
   * @param {Object} systemService - Service for system data updates
   * @param {Object} logger - Logger instance
   */
  constructor(io, notificationService, systemService, logger) {
    this.io = io;
    this.notificationService = notificationService;
    this.systemService = systemService;
    this.logger = logger || console; // Fallback to console if not provided
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

      // System Notifications REQUESTS (from other services -> DB)
      await this.redisSubscriber.subscribe('system:notifications', (message) => {
        this.handleNotificationRequest(message);
      });

      // System Notifications EVENTS (from DB -> WS)
      await this.redisSubscriber.subscribe('system:notifications:events', (message) => {
        this.broadcastToClients(message);
      });

      this.logger.info('✅ SocketService: Subscribed to Redis channels');
    } catch (err) {
      this.logger.error({ err }, '❌ SocketService Error');
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
      this.logger.error({ err: e }, 'Error broadcasting tick');
    }
  }

  broadcastSignal(message) {
    try {
      this.io.to('signals-stream').emit('signal', JSON.parse(message));
    } catch (e) {
      console.error('Error broadcasting signal:', e);
    }
  }

  /**
   * Handles system notifications from Redis:
   * 1. Persists to database via NotificationService
   * 2. Broadcasts to all connected WebSocket clients
   * 
   * @param {string} message - JSON string from Redis
   */
  /**
   * Handles notification REQUEST from other services (e.g. Processing Layer)
   * Only persists to DB. Broadcasting happens via event subscription.
   */
  async handleNotificationRequest(message) {
    try {
      const data = JSON.parse(message);
      
      // Persist to database (if notificationService is available)
      if (this.notificationService) {
        await this.notificationService.createNotification({
          type: data.type || 'INFO',
          metadata: data.metadata || data
        });
      }

      // Check for backfill stats to refresh data availability (Source of Truth)
      if (data.type === 'BACKFILL_STATS' && this.systemService) {
         const symbol = data.metadata?.metrics?.symbol || data.metadata?.symbol;
         if (symbol) {
            // Fire and forget (don't await) to not block notification processing
            this.systemService.refreshDataAvailability(symbol).catch(err => {
               console.error(`Error refreshing data availability for ${symbol}:`, err);
            });
         }
      }
    } catch (e) {
      console.error('Error handling notification request:', e);
    }
  }

  /**
   * Broadcasts notification to WebSocket clients
   * Triggered by 'system:notifications:events'
   */
  broadcastToClients(message) {
    try {
      const data = typeof message === 'string' ? JSON.parse(message) : message;
      this.io.emit('system:notification', data);
    } catch (e) {
      console.error('Error broadcasting notification:', e);
    }
  }
}

module.exports = SocketService;
