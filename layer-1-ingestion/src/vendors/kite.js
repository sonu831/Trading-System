/**
 * Zerodha Kite Vendor Integration
 */
const WebSocket = require('ws');
const { BaseVendor } = require('./base');
const { logger } = require('../../utils/logger');
const { metrics } = require('../../utils/metrics');

class KiteVendor extends BaseVendor {
  constructor(options) {
    super(options);
    this.name = 'Kite';
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.symbols = options.symbols || []; // Expected to be array of objects with token

    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.heartbeatInterval = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      const url = `wss://ws.kite.trade?api_key=${this.apiKey}&access_token=${this.accessToken}`;

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        logger.info('✅ Kite WebSocket connected');
        this.connected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;

        // Subscribe to all symbols
        this.subscribe();

        // Start heartbeat
        this.startHeartbeat();

        metrics.websocketConnections.set(1);
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        logger.warn('⚠️ Kite WebSocket closed');
        this.connected = false;
        metrics.websocketConnections.set(0);
        this.stopHeartbeat();
        this.reconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('❌ Kite WebSocket error:', error.message);
        metrics.errorCounter.inc({ type: 'websocket' });
        // Don't reject here usually as 'close' will trigger reconnect,
        // but for initial connect we might want to reject.
        if (!this.connected) reject(error);
      });
    });
  }

  subscribe() {
    if (!this.ws || !this.connected) return;

    const tokens = this.symbols.map((s) => s.token);

    // Subscribe message for Zerodha Kite
    const subscribeMsg = JSON.stringify({
      a: 'subscribe',
      v: tokens,
    });

    this.ws.send(subscribeMsg);

    // Set mode to full (includes market depth)
    const modeMsg = JSON.stringify({
      a: 'mode',
      v: ['full', tokens],
    });

    this.ws.send(modeMsg);

    logger.info(`Subscribed to ${tokens.length} instruments on Kite`);
  }

  handleMessage(data) {
    try {
      // Zerodha sends binary data for ticks
      if (Buffer.isBuffer(data)) {
        const ticks = this.parseBinaryTicks(data);
        ticks.forEach((tick) => {
          if (this.onTick) {
            this.onTick(tick);
          }
        });
      }
    } catch (error) {
      logger.error('Error parsing messgae:', error);
      metrics.errorCounter.inc({ type: 'parse_error' });
    }
  }

  parseBinaryTicks(buffer) {
    const ticks = [];

    // Number of packets
    const numberOfPackets = buffer.readInt16BE(0);
    let offset = 2;

    for (let i = 0; i < numberOfPackets; i++) {
      const packetLength = buffer.readInt16BE(offset);
      offset += 2;

      if (packetLength === 8) {
        // LTP mode packet
        const tick = {
          token: buffer.readInt32BE(offset),
          ltp: buffer.readInt32BE(offset + 4) / 100,
        };
        ticks.push(tick);
      } else if (packetLength >= 44) {
        // Full mode packet
        const tick = {
          token: buffer.readInt32BE(offset),
          ltp: buffer.readInt32BE(offset + 4) / 100,
          ltq: buffer.readInt32BE(offset + 8),
          volume: buffer.readInt32BE(offset + 12),
          buyQuantity: buffer.readInt32BE(offset + 16),
          sellQuantity: buffer.readInt32BE(offset + 20),
          open: buffer.readInt32BE(offset + 24) / 100,
          high: buffer.readInt32BE(offset + 28) / 100,
          low: buffer.readInt32BE(offset + 32) / 100,
          close: buffer.readInt32BE(offset + 36) / 100,
          timestamp: new Date(buffer.readInt32BE(offset + 40) * 1000),
        };
        ticks.push(tick);
      }

      offset += packetLength;
    }

    return ticks;
  }

  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    metrics.reconnectionAttempts.inc();

    logger.info(`Reconnecting in ${this.reconnectDelay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.reconnect();
      }
    }, this.reconnectDelay);
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.connected) {
        this.ws.ping();
      }
    }, 30000);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isConnected() {
    return this.connected;
  }

  async disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    logger.info('Kite WebSocket disconnected');
  }
}

module.exports = { KiteVendor };
