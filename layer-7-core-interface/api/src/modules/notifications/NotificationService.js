/**
 * Service for managing system-wide notifications.
 * valid types: 'SYSTEM', 'BACKFILL_STATS', 'ERROR', 'SUCCESS', 'WARNING'
 */
class NotificationService {
  constructor({ notificationRepository, redis }) {
    this.notificationRepository = notificationRepository;
    this.redis = redis;
  }

  /**
   * Create a new notification.
   * @param {Object} data - Notification data
   * @param {string} data.type - Type of notification (e.g., 'BACKFILL_STATS', 'ERROR')
   * @param {string} data.message - Human readable message
   * @param {Object} data.metadata - Detailed context (metrics, errors, source)
   * @param {string} [data.metadata.source] - Origin service (e.g., 'layer-2-processing')
   * @param {Object} [data.metadata.metrics] - Key-value performance metrics
   * @param {Object} [data.metadata.context] - Additional debugging context
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(data) {
    if (!data.type || !data.message) {
        throw new Error('Notification requires type and message');
    }

    // 1. Persist to DB
    const notification = await this.notificationRepository.create(data);

    // 2. Broadcast via Redis -> SocketService
    if (this.redis) {
      const payload = JSON.stringify(notification);
      if (this.redis.publisher) {
         await this.redis.publisher.publish('system:notifications:events', payload);
      } else {
         await this.redis.publish('system:notifications:events', payload);
      }
    }

    return notification;
  }

  async getNotifications(limit, offset) {
    return this.notificationRepository.getAll(limit, offset);
  }

  async getUnreadCount() {
    return this.notificationRepository.getUnreadCount();
  }

  async markAsRead(id) {
    return this.notificationRepository.markAsRead(id);
  }

  async markAllAsRead() {
    return this.notificationRepository.markAllAsRead();
  }
}

module.exports = NotificationService;
