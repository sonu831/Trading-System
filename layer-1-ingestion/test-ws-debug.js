const WebSocket = require('ws');

const ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJtaXJhZS5pbiIsImV4cCI6MTc2ODc2MzgwNywiaWF0IjoxNzY4Njc3NDA3LCJpc3MiOiJtaXJhZS5pbiIsIm5iZiI6MTQ0NDQ3ODQwMCwicGZtIjoiMSIsInRpZCI6IjE3IiwidWlkIjoiNDA4MjU4IiwidmlkIjoiMjIifQ.jKrnTLf1uPTv0uwmXSZLbPLV_Wc21JC1NrPOxl-nYXg';
const API_KEY_RAW = 'G1c8FKZye50R6d4sRd868Q==';

// VARIATION 1: No Encoding (keep ==)
const URL_RAW = `wss://ws.mstock.trade/?ACCESS_TOKEN=${ACCESS_TOKEN}&API_KEY=${API_KEY_RAW}`;

// VARIATION 2: Encoded (Standard)
const URL_ENCODED = `wss://ws.mstock.trade/?ACCESS_TOKEN=${ACCESS_TOKEN}&API_KEY=${encodeURIComponent(API_KEY_RAW)}`;

// VARIATION 3: No Padding
const URL_NO_PAD = `wss://ws.mstock.trade/?ACCESS_TOKEN=${ACCESS_TOKEN}&API_KEY=${API_KEY_RAW.replace('==', '')}`;

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Origin: 'https://trade.mstock.com',
};

function test(name, url) {
  console.log(`\n--- Testing ${name} ---`);
  console.log(`URL: ${url}`);
  const ws = new WebSocket(url, { headers });

  ws.on('open', () => {
    console.log(`✅ ${name}: Connected!`);
    ws.close();
  });
  ws.on('unexpected-response', (req, res) =>
    console.log(`❌ ${name}: ${res.statusCode} ${res.statusMessage}`)
  );
  ws.on('error', (err) => console.log(`❌ ${name}: Error ${err.message}`));
}

// Run sequentially
setTimeout(() => test('RAW', URL_RAW), 0);
setTimeout(() => test('ENCODED', URL_ENCODED), 2000);
setTimeout(() => test('NO_PAD', URL_NO_PAD), 4000);
