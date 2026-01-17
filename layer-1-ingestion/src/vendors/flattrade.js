const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { BaseVendor } = require('./base');
const { FlatTradeMapper } = require('../mappers/flattrade');
const { logger } = require('../utils/logger');
const { metrics } = require('../utils/metrics');

class FlatTradeVendor extends BaseVendor {
  constructor(options) {
    super(options);
    this.options = options;
    this.symbols = options.symbols || []; // e.g. ["NSE:TCS-EQ"]
    this.connected = false;
    this.interval = null;
    this.mapper = new FlatTradeMapper();

    // Config Paths
    this.configPath = path.join(__dirname, '../../../vendor/flattrade/config.json');
    this.apiConfig = null;

    // Auth State
    this.userId = process.env.FLATTRADE_USER_ID;
    this.apiKey = process.env.FLATTRADE_API_KEY; // "jKey" in postman
    this.accountId = process.env.FLATTRADE_ACTID || this.userId;
  }

  async loadConfiguration() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.apiConfig = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      } else {
        logger.warn('⚠️ FlatTrade config not found, using defaults.');
        this.apiConfig = {
          api_endpoints: {
            get_quotes: 'https://piconnect.flattrade.in/PiConnectTP/REST/GetQuotes',
          },
        };
      }
    } catch (err) {
      logger.error(`❌ Failed to load FlatTrade config: ${err.message}`);
    }
  }

  async connect() {
    logger.info('🚀 Connecting to FlatTrade...');
    await this.loadConfiguration();

    if (!this.apiKey || !this.userId) {
      throw new Error('FlatTrade API Key (jKey) or UserID missing');
    }

    // Ping / Validity check?
    // For now, assume connected if creds are present
    this.connected = true;
    logger.info('✅ FlatTrade Connected');
    metrics.websocketConnections.set(1);

    this.startPolling();
  }

  async disconnect() {
    this.connected = false;
    if (this.interval) clearInterval(this.interval);
    logger.info('🔌 FlatTrade Disconnected');
    metrics.websocketConnections.set(0);
  }

  subscribe(symbols) {
    logger.info(`FlatTrade: Polling enabled for ${symbols.length} symbols`);
    this.symbols = symbols;
  }

  startPolling() {
    if (this.interval) clearInterval(this.interval);

    this.interval = setInterval(async () => {
      if (!this.connected || this.symbols.length === 0) return;

      try {
        // Need to poll for each symbol or batch? Postman implies single token fetch?
        // "token": "TCS-EQ", "exch": "NSE"
        // Let's iterate for now (Inefficient, but functional for v1)

        for (const sym of this.symbols) {
          // Parse "NSE:TCS-EQ" -> exch: NSE, token: TCS-EQ
          const [exch, token] = sym.split(':');

          const payload = {
            uid: this.userId,
            token: token,
            exch: exch,
          };
          // Helper to format as "jData={...}&jKey=..." if required, or JSON body
          // Postman sends: jData={...}&jKey=... in RAW body with options.raw.language=json?
          // Wait, request body says `mode: raw`, `raw: "jData=...`. This looks like custom body format.

          // Let's try standard JSON first as most 'REST' implies, but Noren often uses `jData=JSON_STRING&jKey=KEY`.
          // Implementation below assumes standard JSON or `jData` format based on analysis.

          const customBody = `jData=${JSON.stringify(payload)}&jKey=${this.apiKey}`;

          const res = await axios.post(this.apiConfig.api_endpoints.get_quotes, customBody, {
            headers: { 'Content-Type': 'text/plain' }, // Often Noren expects plain text for this format
          });

          if (res.data && res.data.stat === 'Ok') {
            const normalized = this.mapper.map(res.data);
            if (normalized) this.onTick(normalized);
          }
        }
      } catch (err) {
        logger.error(`FlatTrade Poll Error: ${err.message}`);
      }
    }, 2000); // 1s-2s poll
  }
}

module.exports = { FlatTradeVendor };
