const fp = require('fastify-plugin');
const socketio = require('fastify-socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');
const SocketService = require('../services/SocketService');

async function socketPlugin(fastify, options) {
  // Redis Pub/Sub for Socket.io Adapter (Scaling across multiple instances)
  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();

  await Promise.all([pubClient.connect(), subClient.connect()]);

  fastify.register(socketio, {
    cors: {
      origin: '*', // Adjust for production
      methods: ['GET', 'POST'],
    },
    adapter: createAdapter(pubClient, subClient),
  });

  fastify.ready((err) => {
    if (err) throw err;

    const io = fastify.io;

    // Initialize Service handling logic
    // Initialize SocketService with notificationService for persistence and systemService for data refresh
    const notificationService = fastify.container.resolve('notificationService');
    const systemService = fastify.container.resolve('systemService');
    const logger = fastify.container.resolve('logger');
    const socketService = new SocketService(io, notificationService, systemService, logger);

    // Make service available via DI/Decorators if needed
    // fastify.decorate('socketService', socketService);

    io.on('connection', (socket) => {
      fastify.log.info(`WS Client Connected: ${socket.id}`);

      // Join rooms based on client request
      socket.on('subscribe', (room) => {
        socket.join(room);
        fastify.log.info(`Client ${socket.id} joined ${room}`);
      });

      socket.on('disconnect', () => {
        fastify.log.info(`WS Client Disconnected: ${socket.id}`);
      });
    });
  });
}

module.exports = fp(socketPlugin);
