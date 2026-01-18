/**
 * Restored Verification Script: 2-Step Auth & Historical Data
 *
 * Uses the MStockVendor class to perform:
 * 1. Login (Step 1)
 * 2. TOTP Verification (Step 2)
 * 3. Historical Data Fetching (with Chunking)
 */

require('ts-node').register({
  transpileOnly: true,
  ignore: [/node_modules\/(?!@mstock-mirae-asset)/],
});

require('dotenv').config({ path: '../.env' });
const { MStockVendor } = require('./src/vendors/mstock');
const { DateTime } = require('luxon');

// --- Helper: Parse CLI Args ---
const args = process.argv.slice(2);
const getArg = (flag, defaultValue) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : defaultValue;
};

// Default: ACC (NSE:22), Last 3 days
const TARGET_SYMBOL = getArg('--symbol', 'NSE:22');
const HISTORY_DAYS = parseInt(getArg('--days', '3'), 10);

async function runVerification() {
  console.log(`🚀 Restoring 2-Step Authentication & Historical Data Test...`);
  console.log(`🎯 Target: ${TARGET_SYMBOL}, History: Last ${HISTORY_DAYS} days`);

  const vendor = new MStockVendor({
    symbols: [TARGET_SYMBOL],
    onTick: (tick) => console.log('Tick:', tick),
  });

  try {
    // --- Step 1 & 2: Authentication ---
    console.log('🔐 Starting Authentication Flow...');
    await vendor.connect();

    if (vendor.isConnected() || vendor.accessToken) {
      console.log('✅ Authentication Success! Token Generated.');
    } else {
      console.error('❌ Authentication Failed.');
      return;
    }

    // --- Step 3: Historical Data ---
    // Calculate dates dynamically based on input
    const end = DateTime.now();
    const start = end.minus({ days: HISTORY_DAYS });

    const [exchange, token] = TARGET_SYMBOL.includes(':')
      ? TARGET_SYMBOL.split(':')
      : ['NSE', TARGET_SYMBOL];

    const params = {
      exchange: exchange,
      symboltoken: token,
      interval: 'ONE_MINUTE',
      fromdate: start.toISODate(),
      todate: end.toISODate(),
    };

    console.log(`📅 Fetching Historical Data: ${params.fromdate} to ${params.todate}...`);
    const response = await vendor.fetchData(params);

    console.log('📊 Result:');
    if (response.status && response.data) {
      const candles = response.data.candles || response.data;
      if (Array.isArray(candles)) {
        console.log(`✅ Success! Received ${candles.length} candles.`);
        if (candles.length > 0) {
          console.log('Sample Candle:', candles[0]);
        }
      } else {
        console.log(
          '⚠️ Response received but format unexpected:',
          JSON.stringify(response.data).substring(0, 100)
        );
      }
    } else {
      console.log('❌ Fetch Failed:', response.message);
    }

    // --- Step 4: Cleanup ---
    await vendor.disconnect();
  } catch (e) {
    console.error('❌ Verification Exception:', e);
  }
}

runVerification();
