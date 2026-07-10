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
    const socketService = new SocketService(io);

    // Client connection handling
    io.on('connection', (socket) => {
      fastify.log.info(`WS Client Connected: ${socket.id}`);

      socket.on('subscribe', (room) => {
        socket.join(room);
        fastify.log.info(`Client ${socket.id} joined ${room}`);
      });

      socket.on('disconnect', () => {
        fastify.log.info(`WS Client Disconnected: ${socket.id}`);
      });
    });

    // ── Real-time push publishers ──────────────────
    // Listen on Redis channels and broadcast to connected clients

    // Ticks: Redis channel "market_ticks" → socket room "ticks"
    subClient.subscribe('market_ticks', (message) => {
      try {
        const tick = typeof message === 'string' ? JSON.parse(message) : message;
        io.to('ticks').emit('tick', tick);
      } catch (_) {}
    });

    // Option chain: Redis channel "option_chain_updates" → socket room "chain"
    subClient.subscribe('option_chain_updates', (message) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        io.to('chain').emit('chain', data);
      } catch (_) {}
    });

    // Regime: Redis channel "market-regime" → socket room "regime"
    subClient.subscribe('market-regime', (message) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        io.to('regime').emit('regime', data);
      } catch (_) {}
    });

    // Positions: Redis channel "execution:state" → socket room "positions"
    subClient.subscribe('execution:state', (message) => {
      try {
        const state = typeof message === 'string' ? JSON.parse(message) : message;
        io.to('positions').emit('positions', state.positions || []);
      } catch (_) {}
    });

    fastify.log.info('WebSocket real-time publishers active');
  });
}

module.exports = fp(socketPlugin);
