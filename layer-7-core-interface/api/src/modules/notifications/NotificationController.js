/**
 * Controller for managing system notifications.
 * Provides endpoints for creating, retrieving, and managing notification read status.
 * 
 * @class NotificationController
 */
class NotificationController {
  constructor({ notificationService }) {
    this.notificationService = notificationService;
  }

  /**
   * Get paginated list of notifications.
   * 
   * @route GET /api/v1/notifications
   * @queryparam {number} [limit=50] - Maximum number of notifications to return
   * @queryparam {number} [offset=0] - Number of notifications to skip
   * @returns {Object} Response with notifications array
   * @returns {boolean} response.success - Operation status
   * @returns {number} response.count - Number of notifications returned
   * @returns {Array<Object>} response.data - Array of notification objects
   * @returns {number} response.data[].id - Notification ID
   * @returns {string} response.data[].type - Notification type (BACKFILL_STATS, ERROR, etc.)
   * @returns {string} response.data[].message - Human-readable message
   * @returns {Object} response.data[].metadata - Detailed context and metrics
   * @returns {boolean} response.data[].is_read - Read status
   * @returns {string} response.data[].created_at - ISO timestamp
   */
  async getNotifications(req, reply) {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const notifications = await this.notificationService.getNotifications(limit, offset);
    return { success: true, count: notifications.length, data: notifications };
  }

  /**
   * Create a new notification (Internal/Admin use).
   * 
   * @route POST /api/v1/notifications
   * @body {Object} data - Notification data
   * @body {string} data.type - Notification type
   * @body {string} data.message - Human-readable message
   * @body {Object} data.metadata - Detailed context
   * @body {string} [data.metadata.source] - Origin service
   * @body {Object} [data.metadata.metrics] - Performance metrics
   * @body {Object} [data.metadata.context] - Additional context
   * @returns {Object} Response with created notification
   */
  async createNotification(req, reply) {
    const data = req.body;
    const notification = await this.notificationService.createNotification(data);
    return { success: true, data: notification };
  }

  /**
   * Mark a specific notification as read.
   * 
   * @route PUT /api/v1/notifications/:id/read
   * @param {number} id - Notification ID
   * @returns {Object} Success response
   */
  async markAsRead(req, reply) {
    const { id } = req.params;
    await this.notificationService.markAsRead(id);
    return { success: true, message: 'Marked as read' };
  }

  /**
   * Mark all notifications as read.
   * 
   * @route PUT /api/v1/notifications/read-all
   * @returns {Object} Success response
   */
  async markAllAsRead(req, reply) {
    await this.notificationService.markAllAsRead();
    return { success: true, message: 'All notifications marked as read' };
  }
}

module.exports = NotificationController;
