const { ValidationCheckpoints, CHECKPOINTS } = require('./checkpoints');

class LiveGate {
  constructor() {
    this.thresholds = CHECKPOINTS.LIVE.thresholds;
  }

  async check() {
    console.log('\n=== Checkpoint: Live Trading Gate ===\n');

    const checks = {
      sebiRegistered: await this.checkSebiRegistration(),
      brokerConfirmed: await this.checkBrokerRateLimits(),
      minTradesBeforeScale: await this.checkTradeCount(),
    };

    console.log(`  SEBI Algo Registration: ${checks.sebiRegistered ? '✓' : '✗'}`);
    console.log(`  Broker Rate Limits Confirmed: ${checks.brokerConfirmed ? '✓' : '✗'}`);
    console.log(`  Current trade count: ${checks.minTradesBeforeScale.actual || 0} / ${this.thresholds.minTradesBeforeScale.min} before scaling`);

    const errors = [];
    if (!checks.sebiRegistered) errors.push('SEBI algorithm registration required before live trading');
    if (!checks.brokerConfirmed) errors.push('Broker API rate limits must be confirmed before live trading');

    const tradeCountOk = checks.minTradesBeforeScale.actual >= this.thresholds.minTradesBeforeScale.min;
    if (!tradeCountOk && checks.minTradesBeforeScale.actual > 0) {
      const remaining = this.thresholds.minTradesBeforeScale.min - checks.minTradesBeforeScale.actual;
      errors.push(`${remaining} more trades needed before scaling beyond 1 lot`);
    }

    const sebiOk = checks.sebiRegistered === true;
    const brokerOk = checks.brokerConfirmed === true;
    const passed = sebiOk && brokerOk;

    const result = { passed, metrics: checks, errors };

    const cp = new ValidationCheckpoints();
    cp.recordAttempt('live', result);

    console.log(`\nLive gate: ${result.passed ? 'PASSED — Ready for 1-lot live' : 'BLOCKED'}`);
    if (!result.passed) {
      console.log('Blocks:');
      errors.forEach(e => console.log(`  ✗ ${e}`));
    }

    console.log(`\nSizing recommendation: start 1 lot (maxLots=1), scale to 2-3 only after 20-30 profitable trades.`);
    return result;
  }

  async checkSebiRegistration() {
    const envVal = process.env.SEBI_REGISTERED;
    return envVal === 'true' || envVal === '1';
  }

  async checkBrokerRateLimits() {
    const envVal = process.env.BROKER_RATE_LIMITS_CONFIRMED;
    return envVal === 'true' || envVal === '1';
  }

  async checkTradeCount() {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({ connectionString: process.env.TIMESCALE_URL });
      const res = await pool.query(`SELECT COUNT(*) as cnt FROM trades WHERE broker = 'live'`);
      const count = parseInt(res.rows[0].cnt) || 0;
      await pool.end();
      return { actual: count };
    } catch (e) {
      return { actual: 0 };
    }
  }
}

async function runCheck() {
  const gate = new LiveGate();
  return await gate.check();
}

module.exports = { LiveGate, runCheck };

if (require.main === module) runCheck().catch(err => { console.error(err); process.exit(1); });
