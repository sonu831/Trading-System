const BaseRepository = require('../../common/repositories/BaseRepository');

/**
 * Repository for managing system_notifications table.
 * Handles all database operations for notifications.
 * 
 * @class NotificationRepository
 * @extends BaseRepository
 */
class NotificationRepository extends BaseRepository {
  constructor({ prisma, redis }) {
    super({ prisma, redis });
  }

  /**
   * Create a new notification record.
   * @param {Object} data - Notification data
   * @param {string} data.type - Notification type
   * @param {string} data.message - Human-readable message
   * @param {Object} data.metadata - JSONB metadata with source, metrics, context
   * @returns {Promise<Object>} Created notification record
   */
  async create(data) {
    return this.prisma.system_notifications.create({
      data: {
        type: data.type,
        message: data.message,
        metadata: data.metadata || {},
        is_read: false,
        created_at: new Date(),
      },
    });
  }

  /**
   * Get paginated notifications ordered by creation date (newest first).
   * @param {number} [limit=50] - Maximum records to return
   * @param {number} [offset=0] - Number of records to skip
   * @returns {Promise<Array>} Array of notification records
   */
  async getAll(limit = 50, offset = 0) {
    return this.prisma.system_notifications.findMany({
      take: limit,
      skip: offset,
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Get count of unread notifications.
   * @returns {Promise<number>} Count of unread notifications
   */
  async getUnreadCount() {
    return this.prisma.system_notifications.count({
      where: { is_read: false },
    });
  }

  /**
   * Mark a specific notification as read.
   * @param {number|string} id - Notification ID
   * @returns {Promise<Object>} Updated notification record
   */
  async markAsRead(id) {
    return this.prisma.system_notifications.update({
      where: { id: parseInt(id) },
      data: { is_read: true },
    });
  }

  /**
   * Mark all unread notifications as read.
   * @returns {Promise<Object>} Prisma batch update result
   */
  async markAllAsRead() {
    return this.prisma.system_notifications.updateMany({
      where: { is_read: false },
      data: { is_read: true },
    });
  }
}

module.exports = NotificationRepository;
