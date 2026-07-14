/**
 * CandleBuffer — polls MStock LTP every 15s, builds 1m OHLCV candles.
 * Writes to TimescaleDB (analysis) + Redis (live dashboard).
 * Starts on boot, runs forever.
 */

const axios = require('axios');

interface CandleState {
  symbol: string;
  token: string;
  minuteTs: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

const SYMBOLS = [
  { symbol: 'NIFTY', token: '26000', exchange: 'NSE' },
  { symbol: 'BANKNIFTY', token: '26009', exchange: 'NSE' },
];

const POLL_INTERVAL = 15000; // 15 seconds
const REDIS_CANDLE_KEY = (sym: string) => `candles:live:${sym}:1m`;
const MAX_REDIS_LEN = 200;

class CandleBuffer {
  private states: Record<string, CandleState> = {};
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private redis: any;
  private prisma: any;
  private jwt = '';
  private apiKey = '';

  constructor({ redis, prisma }: { redis: any; prisma: any }) {
    this.redis = redis;
    this.prisma = prisma;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    // Load credentials + token
    await this.refreshAuth();
    // Start with current minute
    for (const s of SYMBOLS) {
      this.states[s.symbol] = { symbol: s.symbol, token: s.token, minuteTs: 0, open: 0, high: 0, low: 0, close: 0 };
    }

    this.poll();
    this.timer = setInterval(() => this.poll(), POLL_INTERVAL);
    console.log('[CandleBuffer] Started polling NIFTY + BANKNIFTY every 15s');
  }

  stop() {
    this.running = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  private async refreshAuth() {
    try {
      const creds = await this.loadCredentials();
      if (creds?.api_key) this.apiKey = creds.api_key;

      const r = createRedisClient();
      await r.connect();
      const raw = await r.get('broker:session:mstock');
      await r.disconnect();
      if (raw) this.jwt = JSON.parse(raw)?.token || '';
      console.log('[CandleBuffer] Auth refreshed:', !!this.jwt, 'key:', !!this.apiKey);
    } catch (e: any) {
      console.log('[CandleBuffer] Auth refresh failed:', e.message);
    }
  }

  private async loadCredentials() {
    try {
      const { decrypt } = require('../utils/crypto');
      const prov = await this.prisma.broker_providers.findFirst({ where: { provider: 'mstock' }, include: { credentials: true } });
      if (!prov) { console.log('[CandleBuffer] No mstock provider'); return null; }
      const creds: Record<string, string> = {};
      for (const c of prov.credentials) {
        if (c.is_active) creds[c.field_name] = decrypt(c.ciphertext, c.iv, c.tag);
      }
      return creds;
    } catch (e: any) { console.log('[CandleBuffer] loadCredentials error:', e.message); return null; }
  }

  private async poll() {
    if (!this.jwt || !this.apiKey) {
      await this.refreshAuth();
      return;
    }

    try {
      // Batch quote: NIFTY + BANKNIFTY in one call
      const tokens = SYMBOLS.map(s => s.token);
      const resp = await axios.post(
        'https://api.mstock.trade/openapi/typeb/instruments/quote',
        { mode: 'LTP', exchangeTokens: { NSE: tokens } },
        {
          headers: {
            'X-PrivateKey': this.apiKey,
            'Authorization': `Bearer ${this.jwt}`,
            'X-Mirae-Version': '1',
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const fetched: any[] = resp.data?.data?.fetched || resp.data?.fetched || [];
      const now = new Date();
      const currentMinute = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()).getTime();

      for (const f of fetched) {
        const token = f.symbolToken;
        const sym = SYMBOLS.find(s => s.token === token);
        if (!sym) continue;
        const ltp = Number(f.ltp) || 0;
        if (!ltp) continue;

        await this.updateCandle(sym.symbol, currentMinute, ltp);
      }
    } catch (e: any) {
      if (e.response?.status === 401) {
        console.log('[CandleBuffer] Token expired — refreshing');
        await this.refreshAuth();
      }
    }
  }

  private async updateCandle(symbol: string, currentMinute: number, ltp: number) {
    const state = this.states[symbol];
    if (!state) return;

    // Minute changed — save previous candle
    if (state.minuteTs > 0 && state.minuteTs !== currentMinute) {
      await this.saveCandle(state);
    }

    if (state.minuteTs !== currentMinute) {
      // New minute candle
      state.minuteTs = currentMinute;
      state.open = ltp;
      state.high = ltp;
      state.low = ltp;
      state.close = ltp;
    } else {
      // Update current minute
      state.high = Math.max(state.high, ltp);
      state.low = Math.min(state.low, ltp);
      state.close = ltp;
    }
  }

  private async saveCandle(state: CandleState) {
    const { symbol, minuteTs, open, high, low, close } = state;
    const time = new Date(minuteTs);

    // Write to TimescaleDB
    try {
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO candles_1m (time, symbol, exchange, open, high, low, close, volume)
         VALUES ($1, $2, 'NSE', $3, $4, $5, $6, 0)
         ON CONFLICT (time, symbol) DO UPDATE SET high=GREATEST(candles_1m.high,$4), low=LEAST(candles_1m.low,$5), close=$6`,
        time, symbol, open, high, low, close,
      );
    } catch (_) { /* DB write best-effort */ }

    // Push to Redis for fast dashboard reads
    try {
      const entry = JSON.stringify({ time: time.toISOString(), open, high, low, close, volume: 0 });
      const key = REDIS_CANDLE_KEY(symbol);
      const rds = this.redis.publisher || this.redis;
      await rds.rPush(key, entry);
      const len = await rds.lLen(key);
      if (len > MAX_REDIS_LEN) {
        await rds.lTrim(key, len - MAX_REDIS_LEN, -1);
      }
    } catch (_) { /* Redis best-effort */ }
  }
}

function createRedisClient() {
  return require('redis').createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' });
}

module.exports = CandleBuffer;
