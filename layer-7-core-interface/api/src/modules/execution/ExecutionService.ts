const axios = require('axios');

/**
 * ExecutionService — the API's window onto the Layer 10 execution engine.
 *
 * L10 is a private service (port 8095 — 8090 is taken by Kafka UI) that owns orders
 * and positions. The dashboard
 * must never talk to it directly, so this proxies the small, safe surface:
 *   GET  /state   POST /kill   POST /resume   POST /square-off
 *
 * Design rules:
 *  - Read timeouts are short: a hung engine must surface as "unreachable", not a
 *    spinner. The operator needs to KNOW the kill switch is out of reach.
 *  - Mutations get a longer timeout — squaring off places real broker orders.
 *  - We never invent a value. If L10 is down we throw; the UI renders "—", not 0.
 */
class ExecutionService {
  constructor() {
    this.baseUrl = (process.env.EXECUTION_URL || 'http://execution:8095').replace(/\/$/, '');
    this.readTimeoutMs = Number(process.env.EXECUTION_READ_TIMEOUT_MS || 2500);
    this.writeTimeoutMs = Number(process.env.EXECUTION_WRITE_TIMEOUT_MS || 15000);
  }

  async request(method, path, timeout) {
    try {
      const res = await axios({
        method,
        url: `${this.baseUrl}${path}`,
        timeout,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (err) {
      if (err.response) {
        const msg = err.response.data?.error || `Execution engine returned ${err.response.status}`;
        const e = new Error(msg);
        e.statusCode = err.response.status;
        throw e;
      }
      const e = new Error(`Execution engine unreachable at ${this.baseUrl} (${err.code || err.message})`);
      e.statusCode = 503;
      throw e;
    }
  }

  /** Normalised snapshot for the dashboard. */
  async getState() {
    const raw = await this.request('get', '/state', this.readTimeoutMs);

    // `killSwitch` lives at the top level on newer engines, inside `risk` on older ones.
    const killSwitch =
      typeof raw?.killSwitch === 'boolean'
        ? raw.killSwitch
        : typeof raw?.risk?.killSwitch === 'boolean'
          ? raw.risk.killSwitch
          : null;

    return {
      mode: raw?.mode ?? null,
      killSwitch,
      positions: Array.isArray(raw?.positions) ? raw.positions : [],
      risk: raw?.risk ?? null,
      timestamp: raw?.timestamp || new Date().toISOString(),
    };
  }

  async kill() {
    return this.request('post', '/kill', this.writeTimeoutMs);
  }

  async resume() {
    return this.request('post', '/resume', this.readTimeoutMs);
  }

  async squareOff() {
    return this.request('post', '/square-off', this.writeTimeoutMs);
  }
}

module.exports = ExecutionService;
