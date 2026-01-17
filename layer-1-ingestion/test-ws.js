const WebSocket = require('ws');

// Short Token (Unwrapped)
const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJVU0VSTkFNRSI6Ik1BMzE4MDMiLCJBUElUWVBFIjoiVFlQRUIiLCJuYmYiOjE3Njg2NzU4NzIsImV4cCI6MTc2ODY3NjE3MiwiaWF0IjoxNzY4Njc1ODcyfQ.ZMv4EwLTDLC4WUPdBBbYZoxMWm-h44lLZ8J_q4H8Gb8';
const keyEncoded = 'AtyXjdSNwxdiEDtfWnV%2BjA%3D%3D';
const url = `wss://ws.mstock.trade/?ACCESS_TOKEN=${token}&API_KEY=${keyEncoded}`;

console.log('Testing WS with Headers...');

const options = {
  headers: {
    Origin: 'https://trade.mstock.com',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
};

const ws = new WebSocket(url, options);

ws.on('open', () => {
  console.log('✅ WS OPENED with Headers!');
  ws.close();
});

ws.on('error', (e) => {
  console.log('❌ WS ERROR:', e.message);
});

ws.on('close', (code, reason) => {
  console.log(`WS CLOSED: ${code} ${reason}`);
});
