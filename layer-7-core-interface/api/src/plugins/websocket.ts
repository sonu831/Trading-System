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
      } catch (err) { fastify.log.warn({ err, channel: 'market_ticks' }, 'WS push: failed to emit tick'); }
    });

    // Option chain: Redis channel "option_chain_updates" → socket room "chain"
    subClient.subscribe('option_chain_updates', (message) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        io.to('chain').emit('chain', data);
      } catch (err) { fastify.log.warn({ err, channel: 'option_chain_updates' }, 'WS push: failed to emit chain'); }
    });

    // Regime: Redis channel "market-regime" → socket room "regime"
    subClient.subscribe('market-regime', (message) => {
      try {
        const data = typeof message === 'string' ? JSON.parse(message) : message;
        io.to('regime').emit('regime', data);
      } catch (err) { fastify.log.warn({ err, channel: 'market-regime' }, 'WS push: failed to emit regime'); }
    });

    // Positions: Redis channel "execution:state" → socket room "positions"
    subClient.subscribe('execution:state', (message) => {
      try { const state = typeof message === 'string' ? JSON.parse(message) : message; io.to('positions').emit('positions', state.positions || []); }
      catch (err) { fastify.log.warn({ err, channel: 'execution:state' }, 'WS push: failed to emit positions'); }
    });

    // Execution mode/kill: Redis channel "execution-events" → socket room "execution"
    subClient.subscribe('execution-events', (message) => {
      try { const data = typeof message === 'string' ? JSON.parse(message) : message; io.to('execution').emit('execution', data); }
      catch (err) { fastify.log.warn({ err, channel: 'execution-events' }, 'WS push: failed to emit execution'); }
    });

    // Alerts: Redis channel "notifications" → socket room "alerts"
    subClient.subscribe('notifications', (message) => {
      try { const data = typeof message === 'string' ? JSON.parse(message) : message; io.to('alerts').emit('alert', data); }
      catch (err) { fastify.log.warn({ err, channel: 'notifications' }, 'WS push: failed to emit alert'); }
    });

    // Breadth: Redis channel "sentiment_scores" → socket room "breadth"
    subClient.subscribe('sentiment_scores', (message) => {
      try { const data = typeof message === 'string' ? JSON.parse(message) : message; io.to('breadth').emit('breadth', data); }
      catch (err) { fastify.log.warn({ err, channel: 'sentiment_scores' }, 'WS push: failed to emit breadth'); }
    });

    fastify.log.info('WebSocket real-time publishers active (9 channels)');
  });
}

module.exports = fp(socketPlugin);
