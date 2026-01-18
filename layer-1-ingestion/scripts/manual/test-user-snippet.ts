import { MTicker } from '@mstock-mirae-asset/nodetradingapi-typeb';

// Mock credentials for compile check
const apiKey = 'mock_key';
const accessToken = 'mock_token';

console.log('--- Attempting to run User Snippet ---');

try {
  // Initialize MTicker (User Style)
  // EXPECTED ERROR: Constructor signature mismatch
  const ticker = new MTicker(apiKey, accessToken, 'wss://ws.mstock.trade', true);

  // Event handlers (User Style)
  // EXPECTED ERROR: .on() does not exist
  ticker.on('ticks', (ticks: any) => {
    console.log('Market data:', ticks);
  });

  ticker.on('connect', () => {
    ticker.sendLoginAfterConnect();
    // Subscribe to instruments with different modes
    // EXPECTED ERROR: subscribe signature mismatch
    ticker.subscribe('NSE', ['1594'], MTicker.MODE_LTP); // LTP only
    ticker.subscribe('NSE', ['2885'], MTicker.MODE_QUOTE); // OHLC + Volume
    ticker.subscribe('NSE', ['1333'], MTicker.MODE_SNAP); // Full market depth
  });

  ticker.on('order_update', (data: any) => {
    console.log('Order update:', data);
  });

  ticker.on('trade_update', (data: any) => {
    console.log('Trade update:', data);
  });

  // Connect to WebSocket
  ticker.connect();
} catch (e: any) {
  console.error('\n❌ CRITICAL CRASH:');
  console.error(e.message);
  if (e.message.includes('is not a constructor')) {
    console.log('REASON: The installed SDK requires an OBJECT config, not positional arguments.');
  }
  if (e.message.includes('ticker.on is not a function')) {
    console.log(
      "REASON: The installed SDK uses properties like 'ticker.onConnect = ...' instead of '.on()'."
    );
  }
}
