async function notificationRoutes(fastify, options) {
  const container = require('../../container');
  const notificationController = container.resolve('notificationController');

  fastify.get('/api/v1/notifications', {
    schema: {
      tags: ['Notifications'],
      description: 'Get paginated list of notifications',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 }
        }
      }
    },
    handler: notificationController.getNotifications.bind(notificationController),
  });

  fastify.post('/api/v1/notifications', {
    schema: {
      tags: ['Notifications'],
      description: 'Create a new notification (Internal/Admin)',
      body: {
        type: 'object',
        required: ['type', 'message'],
        properties: {
          type: { type: 'string' },
          message: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    },
    handler: notificationController.createNotification.bind(notificationController),
  });

  fastify.put('/api/v1/notifications/:id/read', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark a specific notification as read',
      params: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      }
    },
    handler: notificationController.markAsRead.bind(notificationController),
  });

  fastify.put('/api/v1/notifications/read-all', {
    schema: {
      tags: ['Notifications'],
      description: 'Mark all notifications as read'
    },
    handler: notificationController.markAllAsRead.bind(notificationController),
  });
}

module.exports = notificationRoutes;
