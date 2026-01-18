const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const connectionString =
  process.env.TIMESCALE_URL || 'postgresql://trading:trading123@timescaledb:5432/nifty50';

const pool = new Pool({
  connectionString,
  max: 20, // Connection pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle DB client', err);
  process.exit(-1);
});

async function connectDB() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to TimescaleDB');

    // Verify schema exists
    const res = await client.query("SELECT to_regclass('public.candles_1m');");
    if (res.rows[0].to_regclass) {
      console.log("✅ 'candles_1m' hypertable verified.");
    } else {
      console.warn("⚠️ 'candles_1m' table NOT found. Please run migrations.");
    }

    client.release();
  } catch (err) {
    console.error('❌ Failed to connect to TimescaleDB:', err.message);
    // Do not exit, allow retry logic in main loop if needed, or let Docker restart
    throw err;
  }
}

module.exports = {
  pool,
  connectDB,
};
