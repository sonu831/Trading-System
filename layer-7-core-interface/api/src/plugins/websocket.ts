const fp = require('fastify-plugin');
const socketio = require('fastify-socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

// Canonical channel names — single source of truth (rule 3/14)
let CH;
try { CH = require('/app/shared/constants').REDIS_CHANNELS; } catch (_) {
  try { CH = require('../../../shared/constants').REDIS_CHANNELS; } catch (e2) { CH = null; }
}
if (!CH) throw new Error('shared/constants.js REDIS_CHANNELS not resolvable — wiring cannot start');

// Canonical socket.io room names (matches useSocket.ts events)
const ROOMS = {
  TICKS: 'ticks',
  CHAIN: 'chain',
  REGIME: 'regime',
  POSITIONS: 'positions',
  EXECUTION: 'execution',
  ALERTS: 'alerts',
  BREADTH: 'breadth',
  SIGNALS: 'signals',
};

async function socketPlugin(fastify, options) {
  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  const subClient = pubClient.duplicate();
  await Promise.all([pubClient.connect(), subClient.connect()]);

  // DEDICATED subscriber for app channels — NOT the socket.io adapter's client
  const appSub = pubClient.duplicate();
  await appSub.connect();

  // `origin: '*'` let any website open a live socket onto the trading stream.
  // Same allow-list as the REST CORS in index.ts.
  const ALLOWED_ORIGINS = (process.env.DASHBOARD_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  fastify.register(socketio, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'], credentials: true },
    adapter: createAdapter(pubClient, subClient),
  });

  fastify.ready((err) => {
    if (err) throw err;
    const io = fastify.io;

    io.on('connection', (socket) => {
      fastify.log.info(`WS client connected: ${socket.id}`);
      socket.on('subscribe', (room) => { socket.join(room); });
      socket.on('disconnect', () => { fastify.log.info(`WS client disconnected: ${socket.id}`); });
    });

    // ── Channel → Room relay (ONE relay, canonical names) ──
    const relay = (channel, room, event, transform) => {
      appSub.subscribe(channel, (message) => {
        try {
          const data = typeof message === 'string' ? JSON.parse(message) : message;
          const payload = transform ? transform(data) : data;
          io.to(room).emit(event, payload);
        } catch (err) { fastify.log.warn({ err, channel, room }, 'WS relay failed'); }
      });
    };

    relay(CH.TICKS, ROOMS.TICKS, 'tick');
    relay(CH.OPTION_CHAIN, ROOMS.CHAIN, 'chain');
    relay(CH.REGIME, ROOMS.REGIME, 'regime');
    relay(CH.EXECUTION_STATE, ROOMS.POSITIONS, 'positions', (s) => s.positions || []);
    relay(CH.EXECUTION_EVENTS, ROOMS.EXECUTION, 'execution');
    relay(CH.ALERTS, ROOMS.ALERTS, 'alert');
    relay(CH.BREADTH, ROOMS.BREADTH, 'breadth');
    relay(CH.SIGNALS, ROOMS.SIGNALS, 'signal');

    fastify.log.info('WebSocket relay active — 8 channels, one relay, no duplicate subscriptions');
  });
}

module.exports = fp(socketPlugin);
