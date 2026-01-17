const { MTicker } = require('@mstock-mirae-asset/nodetradingapi-typeb');

// HARDCODED CREDENTIALS FOR TESTING
// Replace these with the values from your .env or just run it with ENV vars
const API_KEY = process.env.MSTOCK_API_KEY || 'YOUR_API_KEY';
const ACCESS_TOKEN = process.env.MSTOCK_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN';

// 1. The User's Desired Logic (adapted to installed SDK 0.0.2)
console.log('--- Starting Patched MTicker Test ---');

try {
  // ⚠️ CRITICAL CHANGE: The installed SDK 0.0.2 constructor takes an OBJECT, not positional args.
  // User Wrapper: const ticker = new MTicker(apiKey, accessToken, 'wss://ws.mstock.trade', true); << THIS WILL FAIL

  // Correct Implementation for 0.0.2:
  const params = {
    api_key: encodeURIComponent(API_KEY), // Must encode key
    access_token: encodeURIComponent(ACCESS_TOKEN), // Must encode token
    maxReconnectionAttempts: 10,
    reconnectDelay: 2000,
  };

  console.log('Initializing MTicker with Config Object:', JSON.stringify(params, null, 2));

  const ticker = new MTicker(params);

  // 2. Event Handlers (Property based for 0.0.2)
  // User Snippet: ticker.on('ticks', ...) << THIS DOES NOT EXIST on 0.0.2

  // Correct:
  ticker.onBroadcastReceived = (ticks) => {
    console.log('✅ Market data:', ticks);
  };

  ticker.onConnect = () => {
    console.log('✅ Connected!');
    ticker.sendLoginAfterConnect();

    // User Snippet: ticker.subscribe('NSE', ['1594'], MTicker.MODE_LTP);
    // Correct for 0.0.2: subscribe takes number[] only. Mode is set differently or globally?
    // Checking SDK: subscribe(tokens: number[])

    console.log('Subscribing to NSE:22 (ACC)...');
    ticker.subscribe([22]);
  };

  ticker.onError = (err) => {
    console.log('❌ Error:', err);
  };

  ticker.onClose = () => {
    console.log('⚠️ Closed');
  };

  // Connect
  ticker.connect();
} catch (e) {
  console.error('CRASH:', e.message);
}
