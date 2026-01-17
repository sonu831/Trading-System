/**
 * WebSocket Manager - Handles connections to market data providers
 * 
 * Features:
 * - Connection pooling
 * - Auto-reconnection with exponential backoff
 * - Heartbeat monitoring
 * - Backpressure handling
 */

const WebSocket = require('ws');
const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');

class WebSocketManager {
  constructor(options) {
    this.apiKey = options.apiKey;
    this.accessToken = options.accessToken;
    this.symbols = options.symbols;
    this.onTick = options.onTick;
    
    this.ws = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = Infinity;
    this.reconnectDelay = 1000;
    this.maxReconnectDelay = 30000;
    this.heartbeatInterval = null;
  }

  /**
   * Connect to WebSocket server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const url = `wss://ws.kite.trade?api_key=${this.apiKey}&access_token=${this.accessToken}`;
      
      this.ws = new WebSocket(url);
      
      this.ws.on('open', () => {
        logger.info('WebSocket connected');
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
        logger.warn('WebSocket closed');
        this.connected = false;
        metrics.websocketConnections.set(0);
        this.stopHeartbeat();
        this.reconnect();
      });

      this.ws.on('error', (error) => {
        logger.error('WebSocket error:', error.message);
        metrics.errorCounter.inc({ type: 'websocket' });
        reject(error);
      });
    });
  }

  /**
   * Subscribe to symbols
   */
  subscribe() {
    const tokens = this.symbols.map(s => s.token);
    
    // Subscribe message for Zerodha Kite
    const subscribeMsg = JSON.stringify({
      a: 'subscribe',
      v: tokens
    });
    
    this.ws.send(subscribeMsg);
    
    // Set mode to full (includes market depth)
    const modeMsg = JSON.stringify({
      a: 'mode',
      v: ['full', tokens]
    });
    
    this.ws.send(modeMsg);
    
    logger.info(`Subscribed to ${tokens.length} instruments`);
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(data) {
    try {
      // Zerodha sends binary data for ticks
      if (Buffer.isBuffer(data)) {
        const ticks = this.parseBinaryTicks(data);
        ticks.forEach(tick => {
          if (this.onTick) {
            this.onTick(tick);
          }
        });
      }
    } catch (error) {
      logger.error('Error parsing message:', error);
      metrics.errorCounter.inc({ type: 'parse_error' });
    }
  }

  /**
   * Parse binary tick data from Zerodha
   */
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
          ltp: buffer.readInt32BE(offset + 4) / 100
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
          timestamp: new Date(buffer.readInt32BE(offset + 40) * 1000)
        };
        ticks.push(tick);
      }
      
      offset += packetLength;
    }
    
    return ticks;
  }

  /**
   * Reconnect with exponential backoff
   */
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
        // Double the delay for next attempt (exponential backoff)
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
        this.reconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.connected) {
        this.ws.ping();
      }
    }, 30000); // Ping every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    logger.info('WebSocket disconnected');
  }
}

module.exports = { WebSocketManager };
